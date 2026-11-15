import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import {
  initDb,
  createMonitor,
  listMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  getRecentCheckResults,
  getAnalytics,
} from '@uptime/db';
import { CreateMonitorSchema, CheckJob } from '@uptime/shared-types';
import { scheduleMonitor, unscheduleMonitor } from '@uptime/scheduler';
import { executeSingleJob } from '@uptime/worker';
import jwt from 'jsonwebtoken';

const PORT = parseInt(process.env.PORT || '4000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_super_secret_key_32chars!';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/uptime_db';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      sub: string;
      type: 'access';
    };
  }
}

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ 
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    } 
  });
  
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  });

  fastify.setErrorHandler((error, request, reply) => {
    if (error.name === 'ZodError') {
      return reply.status(400).send({ 
        error: 'Validation Error', 
        message: 'Invalid request data', 
        details: JSON.parse(error.message) 
      });
    }
    fastify.log.error(error);
    reply.status(error.statusCode || 500).send({ 
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    });
  });

  // JWT Authentication Pre-handler
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.routerPath === '/health') return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.type !== 'access') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }
      request.user = decoded;
    } catch (err) {
      return reply.status(401).send({ error: 'Token invalid or expired' });
    }
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Telemetry Analytics endpoint
  fastify.get<{ Querystring: { hours?: string; monitorId?: string } }>('/v1/analytics', async (request) => {
    const userId = request.user.sub;
    const hours = request.query.hours ? parseInt(request.query.hours, 10) : 24;
    const monitorId = request.query.monitorId;
    return await getAnalytics(userId, isNaN(hours) ? 24 : hours, monitorId);
  });

  // Dashboard Overview System Stats
  fastify.get('/v1/stats', async (request) => {
    const userId = request.user.sub;
    const monitors = await listMonitors(userId);

    const upCount = monitors.filter(m => m.status === 'UP').length;
    const downCount = monitors.filter(m => m.status === 'DOWN').length;

    const analytics = await getAnalytics(userId, 24);

    return {
      totalMonitors: monitors.length,
      upCount,
      downCount,
      activeIncidentsCount: downCount,
      avgResponseTimeMs: analytics.summary.avgResponseTime || 0,
      uptimePercentage: analytics.summary.uptimePercentage ?? 100,
      monitors,
    };
  });

  // List all monitors for authenticated user
  fastify.get('/v1/monitors', async (request) => {
    const userId = request.user.sub;
    return await listMonitors(userId);
  });

  // Create a new monitor
  fastify.post('/v1/monitors', async (request, reply) => {
    const parsed = CreateMonitorSchema.parse(request.body);
    const userId = request.user.sub;
    
    const monitor = await createMonitor(userId, parsed);
    await scheduleMonitor(monitor).catch((e) =>
      fastify.log.warn(`Scheduler registration warning: ${e.message}`)
    );

    // Trigger immediate first check
    const initialJob: CheckJob = {
      jobId: `init-${monitor.id}-${Date.now()}`,
      monitorId: monitor.id,
      userId: monitor.user_id,
      region: monitor.regions[0] || 'us-east',
      target: monitor.target,
      timeoutMs: monitor.timeout_ms,
      scheduledAt: Date.now(),
    };
    executeSingleJob(initialJob)
      .catch((e) => fastify.log.error(`Initial check error: ${e.message}`));

    reply.status(201).send(monitor);
  });

  // Get single monitor by ID (user isolated)
  fastify.get<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;
    const monitor = await getMonitorById(id, userId);
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });

    const results = await getRecentCheckResults(id, 50, userId);

    return {
      ...monitor,
      recentResults: results,
    };
  });

  // Update monitor (user isolated)
  fastify.patch<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;
    const updated = await updateMonitor(id, userId, request.body as any);
    if (!updated) return reply.status(404).send({ error: 'Monitor not found' });

    if (updated.enabled) {
      await scheduleMonitor(updated).catch((e) => fastify.log.warn(`Reschedule warning: ${e.message}`));
    } else {
      await unscheduleMonitor(id).catch((e) => fastify.log.warn(`Unschedule warning: ${e.message}`));
    }

    return updated;
  });

  // Delete monitor (user isolated)
  fastify.delete<{ Params: { id: string } }>('/v1/monitors/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;
    const deleted = await deleteMonitor(id, userId);
    if (!deleted) return reply.status(404).send({ error: 'Monitor not found' });
    await unscheduleMonitor(id).catch(() => {});
    return { success: true };
  });

  // Trigger manual probe check (user isolated)
  fastify.post<{ Params: { id: string } }>('/v1/monitors/:id/check', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;
    const monitor = await getMonitorById(id, userId);
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });

    const region = (request.body as any)?.region || monitor.regions[0] || 'us-east';
    const job: CheckJob = {
      jobId: `manual-${id}-${Date.now()}`,
      monitorId: id,
      userId: monitor.user_id,
      region,
      target: monitor.target,
      timeoutMs: monitor.timeout_ms,
      scheduledAt: Date.now(),
    };

    return await executeSingleJob(job);
  });

  // Get recent results for monitor (user isolated)
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/v1/monitors/:id/results', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;
    const monitor = await getMonitorById(id, userId);
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });

    const limit = parseInt(request.query.limit || '50', 10);
    return await getRecentCheckResults(id, isNaN(limit) ? 50 : limit, userId);
  });

  return fastify;
}

export async function startServer(): Promise<void> {
  let app: FastifyInstance | null = null;
  try {
    initDb(DATABASE_URL);
    await redis.connect().catch((err) => {
      console.warn(`[API] Redis connection notice: ${err.message}. Continuing...`);
    });
    console.log('[API] Database initialized successfully.');

    app = await buildApp();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`[API] Server listening on http://localhost:${PORT}`);
  } catch (err) {
    console.error('[API] Server startup failed:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startServer();
}
