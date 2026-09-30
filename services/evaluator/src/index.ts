import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { createIncident, resolveIncident, getMonitorById } from '@uptime/db';
import { CheckResult, MonitorState, AlertEvent } from '@uptime/shared-types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

const kafka = new Kafka({
  clientId: 'evaluator',
  brokers: KAFKA_BROKERS,
  retry: { retries: 5 },
});
const producer = kafka.producer();
let kafkaConnected = false;

export async function processCheckResult(result: CheckResult): Promise<void> {
  const { monitorId, userId, status, region, errorMessage } = result;
  const stateKey = `state:${monitorId}`;

  const monitor = await getMonitorById(monitorId);
  if (!monitor) return;

  const rawState = await redis.hgetall(stateKey);
  let state: MonitorState = {
    monitorId,
    userId,
    status: (rawState.status as any) || 'UP',
    since: rawState.since || new Date().toISOString(),
    consecFail: parseInt(rawState.consecFail || '0', 10),
    consecOk: parseInt(rawState.consecOk || '0', 10),
    incidentId: rawState.incidentId || null,
    lastCheckedAt: new Date().toISOString(),
  };

  const isPassing = status === 0 || status === 1; // 0 = UP, 1 = DEGRADED
  const isFailing = status === 2; // DOWN

  if (isFailing) {
    state.consecOk = 0;
    state.consecFail += 1;

    // Track region verdict in Redis sliding window (last 60s)
    const confirmKey = `confirm:${monitorId}`;
    const now = Date.now();
    await redis.hset(confirmKey, region, now.toString());
    await redis.expire(confirmKey, 120);

    const verdicts = await redis.hgetall(confirmKey);
    const downRegionCount = Object.values(verdicts).filter((timestampStr) => {
      const ts = parseInt(timestampStr, 10);
      return (now - ts) <= 60000;
    }).length;

    // Quorum rule: downRegionCount >= confirm_quorum or consecFail >= 3
    const quorumReached = downRegionCount >= monitor.confirm_quorum || state.consecFail >= 3;

    if (state.status === 'UP') {
      state.status = 'SUSPECT';
      console.log(`[Evaluator] Monitor ${monitor.name} (${monitorId}) transitioned UP -> SUSPECT`);
    }

    if ((state.status === 'SUSPECT' || state.status === 'DEGRADED') && quorumReached) {
      // Transition to DOWN and create Incident
      state.status = 'DOWN';
      const incident = await createIncident({
        user_id: userId,
        monitor_id: monitorId,
        status: 'open',
        severity: 'critical',
        root_cause_region: region,
        error_summary: errorMessage || 'Check assertions failed or endpoint unreachable',
      });
      state.incidentId = incident.id;
      state.since = new Date().toISOString();

      console.log(`[Evaluator] ALERT: Incident opened for monitor ${monitor.name} (${monitorId})! Incident ID: ${incident.id}`);

      const alertEvent: AlertEvent = {
        eventId: `evt-${incident.id}-${Date.now()}`,
        userId,
        monitorId,
        incidentId: incident.id,
        eventType: 'incident.opened',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        monitorName: monitor.name,
        target: monitor.target,
        regions: {
          down: Object.keys(verdicts).filter((k) => verdicts[k] === 'DOWN'),
          up: [],
        },
        summary: errorMessage || `Target ${monitor.target} is unreachable from region ${region}`,
      };

      await publishAlert(alertEvent);
    }
  } else {
    // Passing result
    state.consecFail = 0;
    state.consecOk += 1;

    if (state.status === 'DOWN' || state.status === 'RECOVERING') {
      if (state.status === 'DOWN') {
        state.status = 'RECOVERING';
      }

      // If passing for 2 consecutive checks, declare RECOVERED -> UP
      if (state.consecOk >= 2) {
        state.status = 'UP';
        if (state.incidentId) {
          await resolveIncident(state.incidentId);
          console.log(`[Evaluator] Incident ${state.incidentId} resolved for monitor ${monitor.name}`);

          const alertEvent: AlertEvent = {
            eventId: `evt-res-${state.incidentId}-${Date.now()}`,
            userId,
            monitorId,
            incidentId: state.incidentId,
            eventType: 'incident.resolved',
            severity: 'critical',
            timestamp: new Date().toISOString(),
            monitorName: monitor.name,
            target: monitor.target,
            regions: { down: [], up: [region] },
            summary: `Monitor ${monitor.name} (${monitor.target}) has recovered.`,
          };
          await publishAlert(alertEvent);
          state.incidentId = null;
        }
        state.since = new Date().toISOString();
      }
    } else if (state.status === 'SUSPECT') {
      // False alarm / transient blip
      state.status = 'UP';
    }
  }

  // Save updated state to Redis
  await redis.hmset(stateKey, {
    status: state.status,
    since: state.since,
    consecFail: state.consecFail.toString(),
    consecOk: state.consecOk.toString(),
    incidentId: state.incidentId || '',
    lastCheckedAt: state.lastCheckedAt || '',
  });
}

async function publishAlert(event: AlertEvent) {
  if (kafkaConnected) {
    await producer.send({
      topic: 'alerts',
      messages: [{ key: event.incidentId, value: JSON.stringify(event) }],
    });
  } else {
    console.log(`[Evaluator ALERT Payload]`, JSON.stringify(event, null, 2));
  }
}

export async function runEvaluator() {
  console.log('[Evaluator] Starting Evaluation Engine...');

  try {
    await producer.connect();
    const consumer = kafka.consumer({ groupId: 'evaluator-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'results', fromBeginning: false });
    kafkaConnected = true;

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const result: CheckResult = JSON.parse(message.value.toString());
          await processCheckResult(result);
        } catch (e: any) {
          console.error(`[Evaluator] Error processing result: ${e.message}`);
        }
      },
    });
    console.log('[Evaluator] Connected to Kafka. Consuming results topic.');
  } catch (err) {
    console.warn(`[Evaluator] Kafka connection unavailable (${(err as Error).message}). Evaluator running via direct call mode.`);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  runEvaluator().catch((err) => console.error('[Evaluator] Fatal error:', err));
}
