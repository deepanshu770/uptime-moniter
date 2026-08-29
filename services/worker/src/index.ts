import { Kafka } from 'kafkajs';
import { insertCheckResult } from '@uptime/db';
import { CheckJob, CheckResult } from '@uptime/shared-types';
import { executeCheck } from './checker.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const REGION = process.env.REGION || 'us-east';
const TOPIC = `jobs.region.${REGION}`;

export async function runWorker() {
  console.log(`[Worker - ${REGION}] Starting worker daemon...`);

  const kafka = new Kafka({
    clientId: `worker-${REGION}`,
    brokers: KAFKA_BROKERS,
    retry: { retries: 5 },
  });

  const consumer = kafka.consumer({ groupId: `worker-group-${REGION}` });
  const producer = kafka.producer();

  let kafkaConnected = false;
  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
    kafkaConnected = true;
    console.log(`[Worker - ${REGION}] Connected to Kafka brokers on ${KAFKA_BROKERS.join(',')}. Subscribed to ${TOPIC}`);
  } catch (err) {
    console.warn(`[Worker - ${REGION}] Kafka connection unavailable (${(err as Error).message}). Operating in standalone/DB mode.`);
  }

  if (kafkaConnected) {
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const job: CheckJob = JSON.parse(message.value.toString());
          console.log(`[Worker - ${REGION}] Executing job ${job.jobId} for monitor ${job.monitorId} (${job.target})`);
          
          const result = await executeCheck(job);

          // Save result to Postgres/TimescaleDB
          await insertCheckResult(result).catch((e) =>
            console.error(`[Worker] DB Insert error: ${e.message}`)
          );

          // Publish result to results Kafka topic
          await producer.send({
            topic: 'results',
            messages: [{ key: result.monitorId, value: JSON.stringify(result) }],
          });
        } catch (e: any) {
          console.error(`[Worker - ${REGION}] Error processing message: ${e.message}`);
        }
      },
    });
  }
}

// Export executeSingleJob helper for direct local testing / API manual trigger
export async function executeSingleJob(job: CheckJob): Promise<CheckResult> {
  const result = await executeCheck(job);
  await insertCheckResult(result).catch((e) =>
    console.error(`[Worker] DB Insert error: ${e.message}`)
  );
  return result;
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  runWorker().catch((err) => {
    console.error(`[Worker - ${REGION}] Fatal error:`, err);
  });
}
