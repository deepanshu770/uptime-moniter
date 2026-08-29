import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { request } from 'undici';
import { AlertEvent } from '@uptime/shared-types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

export async function processAlertEvent(event: AlertEvent): Promise<void> {
  const dedupKey = `dedup:${event.incidentId}:${event.eventType}`;
  
  // Idempotency check: set key if not exists with 1 hour TTL
  const acquired = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
  if (!acquired) {
    console.log(`[Notifier] Duplicate alert event suppressed for ${dedupKey}`);
    return;
  }

  console.log(`[Notifier] Processing alert for incident ${event.incidentId} (${event.eventType}): ${event.summary}`);

  // Send Webhook if WEBHOOK_URL is set
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await request(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      });
      console.log(`[Notifier] Webhook notification dispatched to ${webhookUrl}`);
    } catch (err: any) {
      console.error(`[Notifier] Webhook notification error: ${err.message}`);
    }
  }

  // Send Slack notification if SLACK_WEBHOOK_URL is set
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      const color = event.eventType === 'incident.opened' ? '#E53E3E' : '#38A169';
      const text = event.eventType === 'incident.opened' ? `🚨 *INCIDENT OPENED*: ${event.monitorName}` : `✅ *INCIDENT RESOLVED*: ${event.monitorName}`;

      const slackPayload = {
        attachments: [
          {
            color,
            title: text,
            text: event.summary,
            fields: [
              { title: 'Target', value: event.target, short: true },
              { title: 'Severity', value: event.severity, short: true },
              { title: 'Time', value: event.timestamp, short: false },
            ],
          },
        ],
      };

      await request(slackUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });
      console.log(`[Notifier] Slack notification sent.`);
    } catch (err: any) {
      console.error(`[Notifier] Slack notification error: ${err.message}`);
    }
  }
}

export async function runNotifier() {
  console.log('[Notifier] Starting Notification Daemon...');
  const kafka = new Kafka({
    clientId: 'notifier',
    brokers: KAFKA_BROKERS,
    retry: { retries: 5 },
  });

  try {
    const consumer = kafka.consumer({ groupId: 'notifier-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'alerts', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const event: AlertEvent = JSON.parse(message.value.toString());
          await processAlertEvent(event);
        } catch (e: any) {
          console.error(`[Notifier] Error processing alert: ${e.message}`);
        }
      },
    });
    console.log('[Notifier] Consuming alerts topic.');
  } catch (err) {
    console.warn(`[Notifier] Kafka connection unavailable (${(err as Error).message}). Standing by for direct calls.`);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  runNotifier().catch((err) => console.error('[Notifier] Fatal error:', err));
}
