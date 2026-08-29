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
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status: 2, // DOWN
      responseTimeMs: 0,
      timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, total_ms: 0 },
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

async function executeHttpCheck(job: CheckJob, startTime: string): Promise<CheckResult> {
  const startTotal = performance.now();
  let dnsTime = 0;
  let tcpTime = 0;
  let tlsTime = 0;
  let ttfbTime = 0;
  let responseStatusCode = 0;
  let bodyText = '';

  try {
    const { gotScraping } = await import('got-scraping');
    
    const response = await gotScraping({
      url: job.target,
      method: (job.config.method || 'GET') as any,
      body: job.config.body,
      headers: job.config.headers || {},
      timeout: { request: job.timeoutMs },
      retry: { limit: 0 },
      throwHttpErrors: false,
    });

    responseStatusCode = response.statusCode;
    bodyText = response.body;

    const timingsObj = response.timings?.phases;
    if (timingsObj) {
      dnsTime = timingsObj.dns || 0;
      tcpTime = timingsObj.tcp || 0;
      tlsTime = timingsObj.tls || 0;
      ttfbTime = timingsObj.firstByte || 0;
    }
    
    const totalTime = Math.round(performance.now() - startTotal);
    const timings: PhaseTimings = {
      dns_ms: Math.round(dnsTime),
      tcp_ms: Math.round(tcpTime),
      tls_ms: Math.round(tlsTime),
      ttfb_ms: Math.round(ttfbTime),
      total_ms: totalTime,
    };

    // Assertions
    const failedAssertions: string[] = [];
    const assertions = job.config.assertions || [
      { type: 'status', op: 'equals', value: 200 },
    ];

    for (const a of assertions) {
      if (a.type === 'status') {
        const expected = Number(a.value ?? 200);
        if (response.statusCode !== expected) {
          failedAssertions.push(`Expected HTTP status ${expected}, got ${response.statusCode}`);
        }
      } else if (a.type === 'body') {
        if (a.op === 'contains' && !bodyText.includes(String(a.value))) {
          failedAssertions.push(`Response body does not contain "${a.value}"`);
        } else if (a.op === 'matches' && !new RegExp(String(a.value)).test(bodyText)) {
          failedAssertions.push(`Response body does not match regex /${a.value}/`);
        }
      } else if (a.type === 'latency') {
        const maxMs = a.value_ms || Number(a.value) || 2000;
        if (totalTime > maxMs) {
          failedAssertions.push(`Response latency (${totalTime}ms) exceeded maximum (${maxMs}ms)`);
        }
      }
    }

    let status: StatusValue = 0; // UP
    if (failedAssertions.length > 0) {
      status = 2; // DOWN
    } else if (totalTime > 1500) {
      status = 1; // DEGRADED
    }

    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status,
      statusCode: response.statusCode,
      responseTimeMs: totalTime,
      timings,
      failedAssertions: failedAssertions.length > 0 ? failedAssertions : undefined,
      errorMessage: failedAssertions.length > 0 ? failedAssertions.join('; ') : undefined,
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  } catch (err: any) {
    const totalTime = Math.round(performance.now() - startTotal);
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status: 2, // DOWN
      responseTimeMs: totalTime,
      timings: { dns_ms: dnsTime, tcp_ms: tcpTime, tls_ms: tlsTime, ttfb_ms: ttfbTime, total_ms: totalTime },
      errorCode: err.code || 'HTTP_ERROR',
      errorMessage: err.message || 'Probe execution failed',
      failedAssertions: [err.message || 'Execution error'],
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  }
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
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status: elapsed > 2000 ? 1 : 0,
      responseTimeMs: elapsed,
      timings: { dns_ms: 0, tcp_ms: elapsed, tls_ms: 0, ttfb_ms: 0, total_ms: elapsed },
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      jobId: job.jobId,
      monitorId: job.monitorId,
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status: 2,
      responseTimeMs: elapsed,
      timings: { dns_ms: 0, tcp_ms: elapsed, tls_ms: 0, ttfb_ms: 0, total_ms: elapsed },
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
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status,
      responseTimeMs: elapsed,
      timings: { dns_ms: elapsed, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, total_ms: elapsed },
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
      tenantId: job.tenantId,
      region: job.region,
      time: startTime,
      status: 2,
      responseTimeMs: elapsed,
      timings: { dns_ms: elapsed, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, total_ms: elapsed },
      errorCode: 'DNS_RESOLVE_FAIL',
      errorMessage: err.message,
      failedAssertions: [err.message],
      attempt: 1,
      workerId: WORKER_ID,
      idempotencyKey: job.idempotencyKey,
    };
  }
}
