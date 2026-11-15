import { CheckJob, CheckResult } from '@uptime/shared-types';
import { runHttpRequest } from './httpRunner.js';
import { validateTargetSSRF } from './ssrf.js';

const WORKER_ID = process.env.WORKER_ID || 'worker-' + Math.random().toString(36).substring(7);
const ALLOW_LOCALHOST_PROBING = process.env.STRICT_SSRF === 'false';

type StatusValue = 0 | 1 | 2; // 0=UP, 1=DEGRADED, 2=DOWN

export async function executeCheck(job: CheckJob): Promise<CheckResult> {
  const startTime = new Date().toISOString();

  // SSRF Check
  const ssrfRes = await validateTargetSSRF(job.target, ALLOW_LOCALHOST_PROBING);
  if (!ssrfRes.valid) {
    return createErrorResult(job, startTime, ssrfRes.error || 'SSRF Security Violation');
  }

  // Basic HTTP GET Check
  const res = await runHttpRequest(job.target, 'GET', {}, undefined, job.timeoutMs);
  
  let status: StatusValue = 0;
  let errorMessage = res.error?.message;

  if (res.error || res.statusCode >= 400 || res.statusCode === 0) {
    status = 2; // DOWN
    errorMessage = res.error?.message || `HTTP ${res.statusCode}`;
  } else if (res.timings.total_ms > 1500) {
    status = 1; // DEGRADED
  }

  return {
    jobId: job.jobId,
    monitorId: job.monitorId,
    userId: job.userId,
    region: job.region,
    time: startTime,
    status,
    statusCode: res.statusCode,
    responseTimeMs: res.timings.total_ms,
    timings: res.timings,
    tlsExpiryDays: res.tlsExpiryDays,
    errorCode: res.error ? 'HTTP_ERROR' : undefined,
    errorMessage,
    attempt: 1,
    workerId: WORKER_ID,
    idempotencyKey: job.jobId,
  };
}

function createErrorResult(job: CheckJob, startTime: string, message: string): CheckResult {
  return {
    jobId: job.jobId,
    monitorId: job.monitorId,
    userId: job.userId,
    region: job.region,
    time: startTime,
    status: 2, // DOWN
    statusCode: 0,
    responseTimeMs: 0,
    timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
    errorCode: 'CHECK_FAILED',
    errorMessage: message,
    attempt: 1,
    workerId: WORKER_ID,
    idempotencyKey: job.jobId,
  };
}
