import { Kafka } from 'kafkajs';
import { bulkInsertCheckResults, initDb } from '@uptime/db';
import { CheckResult } from '@uptime/shared-types';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/uptime_db';

const kafka = new Kafka({
  clientId: 'evaluator',
  brokers: KAFKA_BROKERS,
});

export async function processCheckResult(result: CheckResult): Promise<void> {
  await bulkInsertCheckResults([result]);
}

export async function runEvaluator() {
  console.log('[Evaluator] Starting Evaluation Engine...');
  initDb(DATABASE_URL);

  const consumer = kafka.consumer({ groupId: 'evaluator-group' });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'results', fromBeginning: false });

    let resultBuffer: CheckResult[] = [];
    let lastFlush = Date.now();

    const flushBuffer = async () => {
      if (resultBuffer.length === 0) return;
      const toInsert = [...resultBuffer];
      resultBuffer = [];
      lastFlush = Date.now();
      
      try {
        await bulkInsertCheckResults(toInsert);
        console.log(`[Evaluator] Bulk inserted ${toInsert.length} telemetry records.`);
      } catch (err: any) {
        console.error(`[Evaluator] Bulk insert failed: ${err.message}`);
      }
    };

    setInterval(flushBuffer, 2000);

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const result: CheckResult = JSON.parse(message.value.toString());
          resultBuffer.push(result);
          
          if (resultBuffer.length >= 100 || Date.now() - lastFlush >= 2000) {
            await flushBuffer();
          }
        } catch (e: any) {
          console.error(`[Evaluator] Error processing result: ${e.message}`);
        }
      },
    });

    console.log('[Evaluator] Connected to Kafka. Consuming results topic.');
  } catch (err) {
    console.warn(`[Evaluator] Kafka connection unavailable (${(err as Error).message}).`);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  runEvaluator().catch((err) => console.error('[Evaluator] Fatal error:', err));
}
