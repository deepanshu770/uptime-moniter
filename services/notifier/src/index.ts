import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { request } from 'undici';
import { AlertEvent } from '@uptime/shared-types';
import { getUserNotificationChannels, logNotification, getPool } from '@uptime/db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

export async function processAlertEvent(event: AlertEvent): Promise<void> {
  const dedupKey = `dedup:${event.incidentId}:${event.eventType}`;
  
  const acquired = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
  if (!acquired) {
    console.log(`[Notifier] Duplicate alert event suppressed for ${dedupKey}`);
    return;
  }

  console.log(`[Notifier] Processing alert for incident ${event.incidentId} (${event.eventType}): ${event.summary}`);

  try {
    // 1. Fetch user_id from the incident
    const p = getPool();
    const res = await p.query('SELECT user_id FROM incidents WHERE id = $1', [event.incidentId]);
    const userId = res.rows[0]?.user_id;
    if (!userId) {
      console.log(`[Notifier] Incident ${event.incidentId} not found or has no user_id.`);
      return;
    }

    const channels = await getUserNotificationChannels(userId);
    
    // Add global fallback if user has no channels (for backwards compatibility with old global ENV vars)
    if (channels.length === 0) {
       if (process.env.WEBHOOK_URL) channels.push({ channel_type: 'webhook', webhook_url: process.env.WEBHOOK_URL });
       if (process.env.SLACK_WEBHOOK_URL) channels.push({ channel_type: 'slack', webhook_url: process.env.SLACK_WEBHOOK_URL });
    }

    for (const channel of channels) {
      const payload = channel.channel_type === 'slack' 
        ? {
            attachments: [{
              color: event.eventType === 'incident.opened' ? '#E53E3E' : '#38A169',
              title: event.eventType === 'incident.opened' ? `🚨 *INCIDENT OPENED*: ${event.monitorName}` : `✅ *INCIDENT RESOLVED*: ${event.monitorName}`,
              text: event.summary,
              fields: [
                { title: 'Target', value: event.target, short: true },
                { title: 'Severity', value: event.severity, short: true },
                { title: 'Time', value: event.timestamp, short: false },
              ],
            }]
          }
        : event;

      try {
        await request(channel.webhook_url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await logNotification(event.incidentId, channel.channel_type, 'SUCCESS', payload, `${dedupKey}:${channel.channel_type}`);
        console.log(`[Notifier] ${channel.channel_type} sent successfully.`);
      } catch (err: any) {
        await logNotification(event.incidentId, channel.channel_type, 'FAILED', payload, `${dedupKey}:${channel.channel_type}`);
        console.error(`[Notifier] ${channel.channel_type} error: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[Notifier] General error processing alert: ${err.message}`);
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
