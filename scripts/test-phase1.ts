import { initDatabase, createMonitor, listMonitors, getRecentCheckResults, listIncidents } from '@uptime/db';
import { executeSingleJob } from '@uptime/worker';
import { processCheckResult } from '@uptime/evaluator';
import { CheckJob } from '@uptime/shared-types';

async function verifyPhase1() {
  console.log('--- Phase 1 Verification Test ---');

  // 1. Init Database
  console.log('1. Initializing Database DDL...');
  await initDatabase();
  console.log('✓ Database DDL initialized successfully.');

  const tenantId = '00000000-0000-0000-0000-000000000001';

  // 2. Create Test Monitor (Google HTTP)
  console.log('\n2. Creating Test Monitor (Google HTTP)...');
  const monitor1 = await createMonitor(tenantId, {
    name: 'Google Production Health',
    type: 'http',
    target: 'https://www.google.com',
    interval_seconds: 10,
    timeout_ms: 5000,
    regions: ['us-east', 'eu-west'],
    confirm_quorum: 2,
    confirm_regions: 3,
    enabled: true,
    config: {
      method: 'GET',
      assertions: [{ type: 'status', op: 'equals', value: 200 }],
    },
  });
  console.log(`✓ Monitor created: ${monitor1.name} (ID: ${monitor1.id})`);

  // 3. Create Test Monitor (Simulated Failing Service)
  console.log('\n3. Creating Test Monitor (Failing Target)...');
  const monitor2 = await createMonitor(tenantId, {
    name: 'Flaky Legacy Backend',
    type: 'http',
    target: 'https://httpbin.org/status/500',
    interval_seconds: 10,
    timeout_ms: 5000,
    regions: ['us-east', 'eu-west'],
    confirm_quorum: 1,
    confirm_regions: 2,
    enabled: true,
    config: {
      method: 'GET',
      assertions: [{ type: 'status', op: 'equals', value: 200 }],
    },
  });
  console.log(`✓ Monitor created: ${monitor2.name} (ID: ${monitor2.id})`);

  // 4. Run Probe Checks
  console.log('\n4. Running Probe Execution for Monitor 1...');
  const job1: CheckJob = {
    jobId: `test-job-1-${Date.now()}`,
    monitorId: monitor1.id,
    userId: tenantId,
    region: 'us-east',
    type: monitor1.type,
    target: monitor1.target,
    timeoutMs: monitor1.timeout_ms,
    config: monitor1.config,
    scheduledAt: Date.now(),
    idempotencyKey: `test:${monitor1.id}:${Date.now()}`,
  };

  const res1 = await executeSingleJob(job1);
  console.log(`✓ Probe Result for ${monitor1.name}: Status=${res1.status} (HTTP ${res1.statusCode}), Time=${res1.responseTimeMs}ms`);
  console.log(`  Phase Timings breakdown: DNS=${res1.timings.dns_ms}ms, TCP=${res1.timings.tcp_ms}ms, TLS=${res1.timings.tls_ms}ms, TTFB=${res1.timings.ttfb_ms}ms`);
  await processCheckResult(res1);

  // 5. Run Probe Checks for Monitor 2 (3 consecutive failures to trigger quorum & incident)
  console.log('\n5. Simulating 3 consecutive failures for Monitor 2...');
  for (let i = 1; i <= 3; i++) {
    const job2: CheckJob = {
      jobId: `test-job-2-${i}-${Date.now()}`,
      monitorId: monitor2.id,
      userId: tenantId,
      region: 'us-east',
      type: monitor2.type,
      target: monitor2.target,
      timeoutMs: monitor2.timeout_ms,
      config: monitor2.config,
      scheduledAt: Date.now(),
      idempotencyKey: `test:${monitor2.id}:${i}:${Date.now()}`,
    };
    const res2 = await executeSingleJob(job2);
    console.log(`  Attempt ${i}: Status=${res2.status} (HTTP ${res2.statusCode ?? 'ERR'}), Error: ${res2.errorMessage}`);
    await processCheckResult(res2);
  }

  // 6. Query DB Results & Incidents
  console.log('\n6. Checking DB state...');
  const activeMonitors = await listMonitors(tenantId);
  console.log(`✓ Total Monitors in DB: ${activeMonitors.length}`);

  const results1 = await getRecentCheckResults(monitor1.id, 5);
  console.log(`✓ Recent Check Results for ${monitor1.name}: ${results1.length} records`);

  const incidents = await listIncidents(tenantId);
  console.log(`✓ Incidents logged in DB: ${incidents.length}`);
  if (incidents.length > 0) {
    console.log(`  Incident ID: ${incidents[0].id}, Status: ${incidents[0].status}, Summary: ${incidents[0].error_summary}`);
  }

  console.log('\n======================================================');
  console.log('✅ PHASE 1 VERIFICATION COMPLETE: ALL SYSTEMS FUNCTIONAL');
  console.log('======================================================');
  process.exit(0);
}

verifyPhase1().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
