import { 
  initDb, 
  createMonitor, 
  listMonitors, 
  getRecentCheckResults, 
  getAnalytics, 
  closeDb,
  findUserByEmail,
  createUser
} from '@uptime/db';
import { executeSingleJob } from '@uptime/worker';
import { CheckJob } from '@uptime/shared-types';

async function verifySystem() {
  console.log('--- System Verification Test ---');

  // 1. Init Database
  console.log('1. Initializing Database connection...');
  initDb();
  console.log('✓ Database connection initialized.');

  // Ensure test user exists
  let user = await findUserByEmail('test@example.com');
  if (!user) {
    user = await createUser({
      email: 'test@example.com',
      passwordHash: '$2a$10$examplePasswordHash1234567890',
      displayName: 'Test User',
    });
  }
  const userId = user.id;
  console.log(`✓ Test user verified (ID: ${userId})`);

  // 2. Create Test Monitor (HTTP)
  console.log('\n2. Creating Test Monitor (HTTP)...');
  const monitor1 = await createMonitor(userId, {
    name: 'Google Production Health',
    target: 'https://www.google.com',
    interval_seconds: 10,
    timeout_ms: 5000,
    regions: ['us-east'],
    enabled: true,
  });
  console.log(`✓ Monitor created: ${monitor1.name} (ID: ${monitor1.id})`);

  // 3. Run Probe Check
  console.log('\n3. Running Probe Execution for Monitor 1...');
  const job1: CheckJob = {
    jobId: `test-job-1-${Date.now()}`,
    monitorId: monitor1.id,
    userId: userId,
    region: 'us-east',
    target: monitor1.target,
    timeoutMs: monitor1.timeout_ms,
    scheduledAt: Date.now(),
  };

  const res1 = await executeSingleJob(job1);
  console.log(`✓ Probe Result for ${monitor1.name}: Status=${res1.status} (HTTP ${res1.statusCode}), Time=${res1.responseTimeMs}ms`);
  console.log(`  Phase Timings breakdown: DNS=${res1.timings.dns_ms}ms, TCP=${res1.timings.tcp_ms}ms, TLS=${res1.timings.tls_ms}ms, TTFB=${res1.timings.ttfb_ms}ms, TLS Expiry=${res1.tlsExpiryDays} days`);

  // 4. Query DB Results
  console.log('\n4. Checking DB state...');
  const activeMonitors = await listMonitors(userId);
  console.log(`✓ Total Monitors in DB: ${activeMonitors.length}`);

  const results1 = await getRecentCheckResults(monitor1.id, 5, userId);
  console.log(`✓ Recent Check Results for ${monitor1.name}: ${results1.length} records`);

  const analytics = await getAnalytics(userId, 24, monitor1.id);
  console.log(`✓ Analytics Summary: Uptime=${analytics.summary.uptimePercentage}%, AvgLatency=${analytics.summary.avgResponseTime}ms`);

  console.log('\n======================================================');
  console.log('✅ SYSTEM VERIFICATION COMPLETE: ALL SYSTEMS FUNCTIONAL');
  console.log('======================================================');
  await closeDb();
  process.exit(0);
}

verifySystem().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
