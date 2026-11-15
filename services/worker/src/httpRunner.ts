import http from 'http';
import https from 'https';
import { URL } from 'url';
import { performance } from 'perf_hooks';
import { PhaseTimings } from '@uptime/shared-types';

export interface HttpResult {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
  timings: PhaseTimings;
  tlsExpiryDays?: number;
  error?: Error;
}

export async function runHttpRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  bodyStr?: string,
  timeoutMs = 10000
): Promise<HttpResult> {
  return new Promise((resolve) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return resolve({
        statusCode: 0, body: '', headers: {},
        timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
        error: new Error(`Invalid URL: \${targetUrl}`)
      });
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const timings: PhaseTimings = { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 };
    let tlsExpiryDays: number | undefined;
    const times = { start: performance.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, end: 0 };

    const req = client.request(parsedUrl, {
      method: method,
      headers: headers,
      timeout: timeoutMs,
      rejectUnauthorized: false,
    }, (res) => {
      times.firstByte = performance.now();
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        if (!times.firstByte) times.firstByte = performance.now();
        chunks.push(chunk);
      });

      res.on('end', () => {
        times.end = performance.now();
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        
        if (!times.firstByte) times.firstByte = times.end;

        timings.dns_ms = Math.max(0, Math.round((times.dns || times.tcp || times.firstByte) - times.start));
        timings.tcp_ms = Math.max(0, Math.round((times.tcp || times.firstByte) - (times.dns || times.start)));
        if (isHttps) {
          timings.tls_ms = Math.max(0, Math.round((times.tls || times.firstByte) - (times.tcp || times.start)));
        }
        timings.ttfb_ms = Math.max(0, Math.round(times.firstByte - (times.tls || times.tcp || times.dns || times.start)));
        timings.download_ms = Math.max(0, Math.round(times.end - times.firstByte));
        timings.total_ms = Math.max(0, Math.round(times.end - times.start));

        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: rawBody,
          timings,
          tlsExpiryDays,
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => { times.dns = performance.now(); });
      socket.on('connect', () => { times.tcp = performance.now(); });
      socket.on('secureConnect', () => {
        times.tls = performance.now();
        const cert = (socket as any).getPeerCertificate?.();
        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          tlsExpiryDays = Math.max(0, Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, body: '', headers: {}, timings, error: new Error(`Request Timeout (\${timeoutMs}ms)`) });
    });

    req.on('error', (err) => {
      times.end = performance.now();
      timings.total_ms = Math.round(times.end - times.start);
      resolve({ statusCode: 0, body: '', headers: {}, timings, error: err });
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}
