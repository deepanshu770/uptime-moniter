import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import { z } from 'zod';
import {
  initDatabase,
  getPool,
  createMonitor,
  listMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  getRecentCheckResults,
  listIncidents,
  resolveIncident,
} from '@uptime/db';
import { CreateMonitorSchema, CheckJob } from '@uptime/shared-types';
import { scheduleMonitor, unscheduleMonitor } from '@uptime/scheduler';
import { executeSingleJob } from '@uptime/worker';
import { processCheckResult } from '@uptime/evaluator';

// Environment variable validation
const PORT = parseInt(process.env.PORT || '4000', 10);
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!process.env.DATABASE_URL) {
  console.warn('[API] WARNING: DATABASE_URL is not set. Assuming database is configured via defaults.');
}

// Initialize Redis client for accessing distributed state
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on('error', (err) => {
  console.error('[API] Redis connection error:', err);
});

/**
 * Builds the Fastify application instance, registers plugins, and sets up routes.
 * 
 * @returns {Promise<FastifyInstance>} The configured Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  await fastify.register(cors, {
    origin: '*', // In production, this should be restricted to trusted origins
  });

  // Global Error Handler for validating Zod schemas and standardizing error responses
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      fastify.log.warn({ err: error }, 'Validation error');
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.errors,
      });
    }
    
    fastify.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  });

  /**
   * GET /health
   * Simple health check endpoint for load balancers and orchestrators.
   */
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  /**
   * GET /v1/stats
   * Retrieves high-level aggregate statistics for the entire tenant workspace.
   * Includes active incidents, total monitors, and a computed global uptime percentage.
   */
  fastify.get('/v1/stats', async () => {
    const monitors = await listMonitors(DEFAULT_TENANT_ID);
    const incidents = await listIncidents(DEFAULT_TENANT_ID);

    let upCount = 0;
    let downCount = 0;
    let totalResponseTime = 0;
    let totalChecksCount = 0;

    const monitorsWithState = await Promise.all(
      monitors.map(async (m) => {
        const state = await redis.hgetall(`state:${m.id}`);
        const status = state.status || 'UP';
        if (status === 'UP' || status === 'DEGRADED') upCount++;
        if (status === 'DOWN' || status === 'SUSPECT') downCount++;

        const recent = await getRecentCheckResults(m.id, 10);
        if (recent.length > 0) {
          const avg = recent.reduce((acc, r) => acc + r.responseTimeMs, 0) / recent.length;
          totalResponseTime += avg;
          totalChecksCount++;
        }

        return {
          ...m,
          status,
          lastCheckedAt: state.lastCheckedAt || null,
        };
      })
    );

    const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

    return {
      totalMonitors: monitors.length,
      upCount,
      downCount,
      activeIncidentsCount: activeIncidents.length,
      avgResponseTimeMs: totalChecksCount > 0 ? Math.round(totalResponseTime / totalChecksCount) : 0,
      uptimePercentage: monitors.length > 0 ? Number(((upCount / monitors.length) * 100).toFixed(2)) : 100,
      monitors: monitorsWithState,
    };
  });

  /**
   * GET /v1/monitors
   * Retrieves a list of all monitors configured for the tenant.
   * Joins live state data from Redis to provide real-time status.
   */
  fastify.get('/v1/monitors', async () => {
    const monitors = await listMonitors(DEFAULT_TENANT_ID);
    return Promise.all(
      monitors.map(async (m) => {
        const state = await redis.hgetall(`state:${m.id}`);
        return {
          ...m,
          status: state.status || 'UP',
          lastCheckedAt: state.lastCheckedAt || null,
          incidentId: state.incidentId || null,
        };
      })
    );
  });

  /**
   * POST /v1/monitors
   * Creates a new monitor configuration.
   * Expects a JSON body matching the CreateMonitorSchema.
   */
  fastify.post('/v1/monitors', async (request, reply) => {
    // Validate request body
    const parsed = CreateMonitorSchema.parse(request.body);
    
    // Persist to Postgres
    const monitor = await createMonitor(DEFAULT_TENANT_ID, parsed);
    
    // Register monitor in the Kafka-based timer wheel scheduler
    await scheduleMonitor(monitor).catch((e) =>
      fastify.log.warn(`Scheduler registration warning: ${e.message}`)
    );

    // Run an initial immediate check asynchronously to establish baseline status
    const initialJob: CheckJob = {
      jobId: `init-${monitor.id}-${Date.now()}`,
      monitorId: monitor.id,
      tenantId: monitor.tenant_id,
      region: monitor.regions[0] || 'us-east',
      type: monitor.type,
      target: monitor.target,
      timeoutMs: monitor.timeout_ms,
      config: monitor.config,
      scheduledAt: Date.now(),
      idempotencyKey: `init:${monitor.id}:${Date.now()}`,
    };
    executeSingleJob(initialJob)
      .then((res) => processCheckResult(res))
      .catch((e) => fastify.log.error(`Initial check error: ${e.message}`));

    reply.status(201).send(monitor);
  });

  /**
   * GET /v1/monitors/:id
   * Retrieves full details for a specific monitor, including its current state and recent check results.
   */
  fastify.get<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    const monitor = await getMonitorById(id);
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });

    const state = await redis.hgetall(`state:${id}`);
    const results = await getRecentCheckResults(id, 50);

    return {
      ...monitor,
      status: state.status || 'UP',
      state,
      recentResults: results,
    };
  });

  /**
   * PATCH /v1/monitors/:id
   * Updates an existing monitor. 
   * If toggled off/on, it automatically coordinates with the scheduler to pause/resume polling.
   */
  fastify.patch<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    const updated = await updateMonitor(id, request.body as any);
    if (!updated) return reply.status(404).send({ error: 'Monitor not found' });

    if (updated.enabled) {
      await scheduleMonitor(updated);
    } else {
      await unscheduleMonitor(id);
    }

    return updated;
  });

  /**
   * DELETE /v1/monitors/:id
   * Removes a monitor permanently from the database and stops its scheduled jobs.
   */
  fastify.delete<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    
    // First remove from the active polling scheduler
    await unscheduleMonitor(id);
    
    // Remove from database
    const deleted = await deleteMonitor(id);
    if (!deleted) return reply.status(404).send({ error: 'Monitor not found' });
    
    return { success: true };
  });

  /**
   * POST /v1/monitors/:id/check
   * Forces an immediate, out-of-band execution of a monitor check.
   * Useful for user-triggered testing ("Run Probe Now").
   */
  fastify.post<{ Params: { id: string } }>('/v1/monitors/:id/check', async (request, reply) => {
    const { id } = request.params;
    const monitor = await getMonitorById(id);
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });

    const region = (request.body as any)?.region || monitor.regions[0] || 'us-east';
    const job: CheckJob = {
      jobId: `manual-${id}-${Date.now()}`,
      monitorId: id,
      tenantId: monitor.tenant_id,
      region,
      type: monitor.type,
      target: monitor.target,
      timeoutMs: monitor.timeout_ms,
      config: monitor.config,
      scheduledAt: Date.now(),
      idempotencyKey: `manual:${id}:${Date.now()}`,
    };

    // Await execution synchronously to return the immediate result to the client
    const result = await executeSingleJob(job);
    
    // Process the result through the standard evaluation engine for state tracking
    await processCheckResult(result);

    return result;
  });

  /**
   * GET /v1/monitors/:id/results
   * Retrieves the raw chronological results of past monitor checks.
   */
  fastify.get<{ Params: { id: string }, Querystring: { limit?: string } }>('/v1/monitors/:id/results', async (request) => {
    const { id } = request.params;
    const limit = parseInt(request.query.limit || '50', 10);
    return getRecentCheckResults(id, limit);
  });

  /**
   * GET /v1/incidents
   * Lists historical and active incidents for the tenant.
   */
  fastify.get('/v1/incidents', async () => {
    return listIncidents(DEFAULT_TENANT_ID, 50);
  });

  /**
   * POST /v1/incidents/:id/acknowledge
   * Manually acknowledges and resolves an active incident.
   */
  fastify.post<{ Params: { id: string } }>('/v1/incidents/:id/acknowledge', async (request, reply) => {
    const { id } = request.params;
    const resolved = await resolveIncident(id);
    if (!resolved) return reply.status(404).send({ error: 'Incident not found' });
    return resolved;
  });

  return fastify;
}

/**
 * Bootstraps and starts the HTTP API Server.
 * Implements graceful shutdown logic to drain database pools and close active connections.
 */
export async function startServer() {
  let app: FastifyInstance | null = null;
  try {
    await initDatabase();
    console.log('[API] Database initialized successfully.');

    app = await buildApp();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`[API] Server listening on http://localhost:${PORT}`);
  } catch (err) {
    console.error('[API] Server startup failed:', err);
    process.exit(1);
  }

  // Graceful Shutdown logic
  const shutdown = async (signal: string) => {
    console.log(`\n[API] Received ${signal}. Starting graceful shutdown...`);
    if (app) {
      await app.close();
      console.log('[API] HTTP server closed.');
    }
    
    try {
      const pool = getPool();
      await pool.end();
      console.log('[API] Database connections closed.');
    } catch (e) {
      console.error('[API] Error closing database pool:', e);
    }
    
    redis.quit();
    console.log('[API] Redis connection closed.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Automatically start the server if executed directly
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startServer();
}
