import { performance } from 'perf_hooks';
import net from 'net';
import tls from 'tls';
import dns from 'dns/promises';
import { Client, Dispatcher } from 'undici';
import { CheckJob, CheckResult, PhaseTimings, StatusValue, Assertion } from '@uptime/shared-types';
import { validateTargetSSRF } from './ssrf.js';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.env.REGION || 'us-east'}-${Math.floor(Math.random() * 1000)}`;
const ALLOW_LOCALHOST_PROBING = process.env.ALLOW_LOCALHOST_PROBING === 'true';

export async function executeCheck(job: CheckJob): Promise<CheckResult> {
  const startTime = new Date().toISOString();

  // SSRF Check
  const ssrfRes = await validateTargetSSRF(job.target, ALLOW_LOCALHOST_PROBING);
  if (!ssrfRes.valid) {
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      userId: job.userId,
      region: job.region,
      time: startTime,
      status: 2, // DOWN
      responseTimeMs: 0,
      timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
      errorCode: 'SSRF_BLOCKED',
      errorMessage: ssrfRes.error || 'SSRF Security Violation',
      failedAssertions: [ssrfRes.error || 'SSRF Violation'],
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  }

  switch (job.type) {
    case 'http':
    case 'api':
      return executeHttpCheck(job, startTime);
    case 'tcp':
    case 'port':
      return executeTcpCheck(job, startTime);
    case 'dns':
      return executeDnsCheck(job, startTime);
    default:
      return executeHttpCheck(job, startTime);
  }
}

import { runHttpRequest, checkAssertions, performExtractions, replaceContextVariables } from './httpRunner.js';

async function executeHttpCheck(job: CheckJob, startTime: string): Promise<CheckResult> {
  const steps = job.config.steps && job.config.steps.length > 0
    ? job.config.steps
    : [{
        name: 'Main Check',
        method: job.config.method || 'GET',
        url: job.target,
        headers: job.config.headers || {},
        body: job.config.body,
        assertions: job.config.assertions || [{ type: 'status', op: 'equals', value: 200 }]
      }];

  let totalMs = 0;
  const timings: PhaseTimings = { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 };
  const context: Record<string, string> = {};
  let tlsExpiryDays: number | undefined;
  let finalStatusCode = 0;
  let failedAssertions: string[] = [];

  for (const step of steps) {
    const startStep = performance.now();
    const url = replaceContextVariables(step.url, context);
    const method = replaceContextVariables(step.method || 'GET', context);
    const body = step.body ? replaceContextVariables(step.body, context) : undefined;
    
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(step.headers || {})) {
      headers[k] = replaceContextVariables(v, context);
    }

    const res = await runHttpRequest(url, method, headers, body, job.timeoutMs);
    
    // Accumulate total timings across all steps (for simplicity)
    timings.dns_ms += res.timings.dns_ms;
    timings.tcp_ms += res.timings.tcp_ms;
    timings.tls_ms += res.timings.tls_ms;
    timings.ttfb_ms += res.timings.ttfb_ms;
    timings.download_ms += res.timings.download_ms;
    timings.total_ms += res.timings.total_ms;
    
    // Use the earliest TLS expiry if there are multiple steps
    if (res.tlsExpiryDays !== undefined) {
      if (tlsExpiryDays === undefined || res.tlsExpiryDays < tlsExpiryDays) tlsExpiryDays = res.tlsExpiryDays;
    }
    
    finalStatusCode = res.statusCode;

    // Check Assertions for this step
    if (step.assertions) {
      const stepFails = checkAssertions(step.assertions, res);
      if (stepFails.length > 0) {
        failedAssertions.push(`Step [${step.name}]: ${stepFails.join(', ')}`);
        break; // Stop executing subsequent steps if a previous one fails its assertions
      }
    }

    if (res.error) {
       failedAssertions.push(`Step [${step.name}] failed: ${res.error.message}`);
       break;
    }

    // Run Extractions for this step
    if (step.extract) {
      performExtractions(step.extract, res, context);
    }
  }

  let status: StatusValue = 0;
  if (failedAssertions.length > 0) {
    status = 2; // DOWN
  } else if (timings.total_ms > 1500) {
    status = 1; // DEGRADED
  }

  return {
    jobId: job.jobId,
    monitorId: job.monitorId,
    userId: job.userId,
    region: job.region,
    time: startTime,
    status,
    statusCode: finalStatusCode,
    responseTimeMs: timings.total_ms,
    timings,
    tlsExpiryDays,
    failedAssertions: failedAssertions.length > 0 ? failedAssertions : undefined,
    errorMessage: failedAssertions.length > 0 ? failedAssertions.join('; ') : undefined,
    attempt: 1,
    workerId: WORKER_ID,
    idempotencyKey: job.idempotencyKey,
  };
}

async function executeTcpCheck(job: CheckJob, startTime: string): Promise<CheckResult> {
  const start = performance.now();
  let port = job.config.port || 80;
  let host = job.target;

  if (job.target.includes(':')) {
    const parts = job.target.split(':');
    host = parts[0];
    port = parseInt(parts[1]) || port;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port, timeout: job.timeoutMs }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`TCP connect timeout (${job.timeoutMs}ms)`));
      });
    });

    const elapsed = Math.round(performance.now() - start);
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      userId: job.userId,
      region: job.region,
      time: startTime,
      status: elapsed > 2000 ? 1 : 0,
      responseTimeMs: elapsed,
      timings: { dns_ms: 0, tcp_ms: elapsed, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: elapsed },
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      userId: job.userId,
      region: job.region,
      time: startTime,
      status: 2,
      responseTimeMs: elapsed,
      timings: { dns_ms: 0, tcp_ms: elapsed, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: elapsed },
      errorCode: 'TCP_CONNECT_FAIL',
      errorMessage: err.message,
      failedAssertions: [err.message],
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  }
}

async function executeDnsCheck(job: CheckJob, startTime: string): Promise<CheckResult> {
  const start = performance.now();
  try {
    const addresses = await dns.lookup(job.target, { all: true });
    const elapsed = Math.round(performance.now() - start);
    const ipList = addresses.map((a) => a.address);

    const failedAssertions: string[] = [];
    if (job.config.expected_dns_ip && !ipList.includes(job.config.expected_dns_ip)) {
      failedAssertions.push(`Expected IP ${job.config.expected_dns_ip} not found in DNS response: [${ipList.join(', ')}]`);
    }

    const status: StatusValue = failedAssertions.length > 0 ? 2 : 0;
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      userId: job.userId,
      region: job.region,
      time: startTime,
      status,
      responseTimeMs: elapsed,
      timings: { dns_ms: elapsed, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: elapsed },
      failedAssertions: failedAssertions.length > 0 ? failedAssertions : undefined,
      errorMessage: failedAssertions.length > 0 ? failedAssertions.join('; ') : undefined,
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      userId: job.userId,
      region: job.region,
      time: startTime,
      status: 2,
      responseTimeMs: elapsed,
      timings: { dns_ms: elapsed, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: elapsed },
      errorCode: 'DNS_RESOLVE_FAIL',
      errorMessage: err.message,
      failedAssertions: [err.message],
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  }
}
