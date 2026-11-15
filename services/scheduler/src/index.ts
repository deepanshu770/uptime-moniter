/**
 * Scheduling Service
 *
 * Responsible for scheduling and dispatching periodic synthetic monitor checks.
 *
 * ## Architecture Overview
 * - **Single Redis Sorted Set (ZSET):**
 *   Uses a single sorted set (`sched:monitors`) where:
 *   - Member: `${monitorId}:${region}`
 *   - Score: Next due timestamp in milliseconds (epoch)
 
 * - **Dual Dispatch Strategy:**
 *   - If Kafka is reachable: Publishes `CheckJob` messages to `jobs.region.${region}` topic.
 *   - If Kafka is unavailable (e.g. local dev): Falls back to direct in-process execution
 *     via `@uptime/worker`, ensuring local development works without external broker dependencies.
 */

import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { getAllEnabledMonitors, getMonitorById, initDb } from '@uptime/db';
import { CheckJob, Monitor } from '@uptime/shared-types';
import { executeSingleJob } from '@uptime/worker';

// ─── Configuration ────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const INSTANCE_ID = process.env.INSTANCE_ID || `sched-${Math.floor(Math.random() * 10000)}`;

/** Redis key for the unified monitor scheduling sorted set */
const SCHEDULE_KEY = 'sched:monitors';

/** Redis lock key to prevent multiple scheduler replicas from processing the same tick */
const TICK_LOCK_KEY = 'sched:tick_lock';

/** TTL for the tick lock in milliseconds (ticks run every 1000ms) */
const TICK_LOCK_TTL_MS = 1500;

// ─── Clients ──────────────────────────────────────────────────────────────────

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

const kafka = new Kafka({
  clientId: 'scheduler',
  brokers: KAFKA_BROKERS,
  retry: { retries: 5 },
});
const producer = kafka.producer();
let kafkaConnected = false;

// ─── Public Scheduling APIs ───────────────────────────────────────────────────

/**
 * Registers or updates a monitor in the schedule.
 *
 * Caches the monitor configuration in Redis and adds an entry into the scheduling
 * sorted set for each configured region with an initial random jitter.
 *
 * @param monitor - The monitor entity to schedule.
 */
export async function scheduleMonitor(monitor: Monitor): Promise<void> {
  const regions = monitor.regions.length > 0 ? monitor.regions : ['us-east'];
  const now = Date.now();

  // Cache monitor configuration for fast retrieval during tick cycles
  await redis.set(`monitor_conf:${monitor.id}`, JSON.stringify(monitor));

  // Add each region target to the sorted set if not already present ('NX')
  const pipeline = redis.pipeline();
  for (const region of regions) {
    const member = `${monitor.id}:${region}`;
    const jitter = Math.floor(Math.random() * 2000); // 0-2s initial jitter
    pipeline.zadd(SCHEDULE_KEY, 'NX', now + jitter, member);
  }
  await pipeline.exec();
}

/**
 * Removes a monitor and all its regional probes from the schedule.
 *
 * @param monitorId - UUID of the monitor to unschedule.
 */
export async function unscheduleMonitor(monitorId: string): Promise<void> {
  // Retrieve cached monitor configuration to identify all scheduled regions
  const confStr = await redis.get(`monitor_conf:${monitorId}`);
  if (confStr) {
    try {
      const conf = JSON.parse(confStr);
      const regions: string[] = conf.regions?.length > 0 ? conf.regions : ['us-east'];
      const membersToRemove = regions.map((region) => `${monitorId}:${region}`);
      
      if (membersToRemove.length > 0) {
        await redis.zrem(SCHEDULE_KEY, ...membersToRemove);
      }
    } catch {
      // If parsing fails, fall back to removing default region
      await redis.zrem(SCHEDULE_KEY, `${monitorId}:us-east`);
    }
    await redis.del(`monitor_conf:${monitorId}`);
  } else {
    // Attempt removing default region if config cache is absent
    await redis.zrem(SCHEDULE_KEY, `${monitorId}:us-east`);
  }
}

// ─── Core Tick & Dispatch Engine ──────────────────────────────────────────────

/**
 * Single scheduler tick executed every second.
 *
 * Flow:
 * 1. Attempts to acquire a short-lived distributed lock (`sched:tick_lock`).
 * 2. Fetches all monitors whose next scheduled run timestamp is <= current time (`ZRANGEBYSCORE`).
 * 3. Temporarily advances their timestamps by 60s using a standard pipelined `ZADD` to prevent
 *    immediate duplicate pickup.
 * 4. Dispatches check jobs via Kafka or direct fallback execution.
 * 5. Re-schedules each monitor to its proper next due time: `now + interval + jitter`.
 */
async function tick(): Promise<void> {
  const now = Date.now();

  // 1. Acquire distributed lock for this tick (auto-expires after 1.5s)
  const acquired = await redis.set(TICK_LOCK_KEY, INSTANCE_ID, 'PX', TICK_LOCK_TTL_MS, 'NX');
  if (!acquired) {
    return; // Another replica instance is actively handling this tick
  }

  try {
    // 2. Fetch up to 200 monitors that are due for execution (score <= now)
    const dueMembers = await redis.zrangebyscore(SCHEDULE_KEY, '-inf', now, 'LIMIT', 0, 200);
    if (!dueMembers || dueMembers.length === 0) {
      return;
    }

    // 3. Simple non-Lua guard: temporarily advance scores by 60s in a single pipeline
    //    so no concurrent or subsequent immediate tick re-evaluates these same members
    const guardPipeline = redis.pipeline();
    for (const member of dueMembers) {
      guardPipeline.zadd(SCHEDULE_KEY, now + 60000, member);
    }
    await guardPipeline.exec();

    // 4. Process and dispatch each due monitor probe
    const reschedulePipeline = redis.pipeline();

    for (const member of dueMembers) {
      const [monitorId, region] = member.split(':');
      if (!monitorId || !region) continue;

      // Fetch monitor details from Redis cache, falling back to database if needed
      let monitor: Monitor | null = null;
      const confStr = await redis.get(`monitor_conf:${monitorId}`);
      if (confStr) {
        try {
          monitor = JSON.parse(confStr);
        } catch {
          monitor = null;
        }
      }

      if (!monitor) {
        monitor = await getMonitorById(monitorId);
        if (monitor) {
          await redis.set(`monitor_conf:${monitorId}`, JSON.stringify(monitor));
        }
      }

      // If monitor was deleted or paused, drop it from the schedule entirely
      if (!monitor || !monitor.enabled) {
        reschedulePipeline.zrem(SCHEDULE_KEY, member);
        continue;
      }

      // Construct probe job payload
      const job: CheckJob = {
        jobId: `job-${monitorId}-${region}-${now}`,
        monitorId: monitor.id,
        userId: monitor.user_id,
        region,
        target: monitor.target,
        timeoutMs: monitor.timeout_ms,
        scheduledAt: now,
      };

      // Dispatch to Kafka topic or execute in-process if standalone
      if (kafkaConnected) {
        await producer.send({
          topic: `jobs.region.${region}`,
          messages: [{ key: monitor.id, value: JSON.stringify(job) }],
        }).catch((err) =>
          console.error(`[Scheduler] Kafka publish error for ${monitor.id}: ${err.message}`)
        );
      } else {
        executeSingleJob(job).catch((err) =>
          console.error(`[Scheduler] Standalone check error for ${monitor.id}: ${err.message}`)
        );
      }

      // 5. Calculate next due execution timestamp with slight jitter to avoid burst synchronization
      const intervalMs = (monitor.interval_seconds || 30) * 1000;
      const maxJitter = Math.min(intervalMs * 0.1, 2000);
      const jitter = Math.floor(Math.random() * maxJitter);
      const nextDue = now + intervalMs + jitter;

      reschedulePipeline.zadd(SCHEDULE_KEY, nextDue, member);
    }

    // Execute all reschedules in a single batch
    await reschedulePipeline.exec();
  } catch (err: any) {
    console.error(`[Scheduler] Tick execution error: ${err.message}`);
  }
}

// ─── Monitor Reconciliation ───────────────────────────────────────────────────

/**
 * Sweeps the database for all enabled monitors and ensures they exist in Redis.
 * Useful upon scheduler startup or to recover from any transient cache loss.
 */
export async function reconcileMonitors(): Promise<void> {
  console.log('[Scheduler] Running reconciliation sweep...');
  try {
    const monitors = await getAllEnabledMonitors();
    for (const monitor of monitors) {
      await scheduleMonitor(monitor);
    }
    console.log(`[Scheduler] Reconciled ${monitors.length} active monitors.`);
  } catch (err: any) {
    console.error(`[Scheduler] Reconciliation error: ${err.message}`);
  }
}

// ─── Service Lifecycle ────────────────────────────────────────────────────────

/**
 * Initializes database connection, Kafka producer, and starts the 1-second tick loop.
 */
export async function startScheduler(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/uptime_db';
  initDb(DATABASE_URL);
  console.log(`[Scheduler ${INSTANCE_ID}] Starting simplified scheduler service...`);

  // Attempt Kafka connection; fall back cleanly if broker is not available
  try {
    await producer.connect();
    kafkaConnected = true;
    console.log('[Scheduler] Connected to Kafka brokers.');
  } catch (err) {
    console.warn(`[Scheduler] Kafka unavailable (${(err as Error).message}). Operating in standalone mode.`);
  }

  // Initial reconciliation against database state
  await reconcileMonitors();

  // Tick loop: evaluates due monitors once every second
  setInterval(() => {
    tick().catch((err) => console.error(`[Scheduler] Tick error: ${err.message}`));
  }, 1000);

  // Periodic reconciliation sweep every 5 minutes
  setInterval(reconcileMonitors, 5 * 60 * 1000);
}

// Start daemon if executed directly
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startScheduler().catch((err) => {
    console.error('[Scheduler] Fatal error:', err);
    process.exit(1);
  });
}
