import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { getAllEnabledMonitors, getMonitorById } from '@uptime/db';
import { CheckJob, Monitor } from '@uptime/shared-types';
import { executeSingleJob } from '@uptime/worker';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOTAL_SHARDS = 16;
const INSTANCE_ID = process.env.INSTANCE_ID || `sched-${Math.floor(Math.random() * 10000)}`;

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

const kafka = new Kafka({
  clientId: 'scheduler',
  brokers: KAFKA_BROKERS,
  retry: { retries: 5 },
});
const producer = kafka.producer();
let kafkaConnected = false;

const POP_DUE_LUA = `
  local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 500)
  if #due > 0 then
    for i, member in ipairs(due) do
      redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + 60000, member)
    end
  end
  return due
`;

function getShardForMonitor(monitorId: string): number {
  let hash = 0;
  for (let i = 0; i < monitorId.length; i++) {
    hash = (hash << 5) - hash + monitorId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % TOTAL_SHARDS;
}

export async function scheduleMonitor(monitor: Monitor): Promise<void> {
  const regions = monitor.regions.length > 0 ? monitor.regions : ['us-east'];
  const now = Date.now();
  
  await redis.set(`monitor_conf:${monitor.id}`, JSON.stringify(monitor));

  for (const region of regions) {
    const member = `${monitor.id}:${region}`;
    const shard = getShardForMonitor(monitor.id);
    const key = `sched:shard:${shard}`;
    const jitter = Math.floor(Math.random() * 2000);
    // Only ZADD if it doesn't exist, to avoid resetting intervals
    await redis.zadd(key, 'NX', now + jitter, member);
  }
}

export async function unscheduleMonitor(monitorId: string): Promise<void> {
  const shard = getShardForMonitor(monitorId);
  const key = `sched:shard:${shard}`;
  
  const confStr = await redis.get(`monitor_conf:${monitorId}`);
  if (confStr) {
    const conf = JSON.parse(confStr);
    const regions = conf.regions.length > 0 ? conf.regions : ['us-east'];
    const toRemove = regions.map((r: string) => `${monitorId}:${r}`);
    if (toRemove.length > 0) {
      await redis.zrem(key, ...toRemove);
    }
    await redis.del(`monitor_conf:${monitorId}`);
  }
}

async function tickShard(shard: number, now: number) {
  // Shard lock to prevent multiple replicas from popping the same shard
  const lockKey = `sched:lock:${shard}`;
  const acquired = await redis.set(lockKey, INSTANCE_ID, 'EX', 2, 'NX');
  if (!acquired) return;

  const key = `sched:shard:${shard}`;
  const due = (await redis.eval(POP_DUE_LUA, 1, key, now)) as string[];

  if (!due || due.length === 0) {
     await redis.del(lockKey);
     return;
  }

  for (const member of due) {
    const [monitorId, region] = member.split(':');
    
    let monitor: Monitor | null = null;
    const confStr = await redis.get(`monitor_conf:${monitorId}`);
    if (confStr) {
      monitor = JSON.parse(confStr);
    } else {
      monitor = await getMonitorById(monitorId);
      if (monitor) await redis.set(`monitor_conf:${monitorId}`, JSON.stringify(monitor));
    }
    

    if (!monitor || !monitor.enabled) {
      continue;
    }

    const timeBucket = Math.floor(now / 1000);
    const job: CheckJob = {
      jobId: `job-${monitorId}-${region}-${now}`,
      monitorId: monitor.id,
      userId: monitor.user_id,
      region,
      type: monitor.type,
      target: monitor.target,
      timeoutMs: monitor.timeout_ms,
      config: monitor.config,
      scheduledAt: now,
      idempotencyKey: `${monitor.id}:${region}:${timeBucket}`,
    };

    if (kafkaConnected) {
      await producer.send({
        topic: `jobs.region.${region}`,
        messages: [{ key: monitor.id, value: JSON.stringify(job) }],
      });
    } else {
      // Standalone direct execution fallback
      executeSingleJob(job).catch((e) =>
        console.error(`[Scheduler] Standalone job exec error: ${e.message}`)
      );
    }

    // Reschedule with jitter
    const intervalMs = monitor.interval_seconds * 1000;
    const jitter = Math.floor(Math.random() * Math.min(intervalMs * 0.1, 2000));
    const nextDue = now + intervalMs + jitter;
    await redis.zadd(key, nextDue, member);
  }
}

export async function reconcileMonitors() {
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

export async function startScheduler() {
  console.log(`[Scheduler ${INSTANCE_ID}] Starting timer wheel scheduler daemon...`);

  try {
    await producer.connect();
    kafkaConnected = true;
    console.log('[Scheduler] Connected to Kafka brokers.');
  } catch (err) {
    console.warn(`[Scheduler] Kafka unavailable (${(err as Error).message}). Operating in standalone direct execution mode.`);
  }

  // Initial reconciliation
  await reconcileMonitors();

  // Tick loop (every 1 second)
  setInterval(async () => {
    const now = Date.now();
    for (let shard = 0; shard < TOTAL_SHARDS; shard++) {
      tickShard(shard, now).catch((e) =>
        console.error(`[Scheduler] Shard ${shard} tick error: ${e.message}`)
      );
    }
  }, 1000);

  // Reconciliation sweep every 5 minutes
  setInterval(reconcileMonitors, 5 * 60 * 1000);
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startScheduler().catch((err) => {
    console.error('[Scheduler] Fatal error:', err);
  });
}
