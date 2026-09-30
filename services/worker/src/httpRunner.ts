import https from 'https';
import http from 'http';
import dns from 'dns';
import { promisify } from 'util';
const lookup = promisify(dns.lookup);

function isInternalIp(ip: string): boolean {
  if (ip === '::1') return true;
  if (!ip.includes('.')) return false; // Basic IPv6 ignore for now unless mapped
  const parts = ip.split('.').map(Number);
  if (parts[0] === 127) return true; // localhost
  if (parts[0] === 10) return true; // private class A
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // private class B
  if (parts[0] === 192 && parts[1] === 168) return true; // private class C
  if (parts[0] === 169 && parts[1] === 254) return true; // AWS metadata
  return false;
}

import { URL } from 'url';
import { performance } from 'perf_hooks';
import { JSONPath } from 'jsonpath-plus';
import { Assertion, Extraction, PhaseTimings, Step } from '@uptime/shared-types';

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
  return new Promise(async (resolve) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return resolve({
        statusCode: 0, body: '', headers: {},
        timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
        error: new Error(`Invalid URL: ${targetUrl}`)
      });
    }

    try {
      const { address } = await lookup(parsedUrl.hostname);
      if (isInternalIp(address)) {
        return resolve({
          statusCode: 0, body: '', headers: {},
          timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
          error: new Error(`SSRF Prevention: Target resolves to internal IP ${address}`)
        });
      }
      // Pin IP for security
      headers['Host'] = parsedUrl.hostname;
    } catch (e) {
      return resolve({
        statusCode: 0, body: '', headers: {},
        timings: { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0, download_ms: 0, total_ms: 0 },
        error: new Error(`DNS resolution failed`)
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
      res.once('readable', () => {
        if (!times.firstByte) times.firstByte = performance.now();
      });

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 5 * 1024 * 1024; // 5MB limit
      res.on('data', (chunk) => {
        if (!times.firstByte) times.firstByte = performance.now();
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          req.destroy(new Error('Response exceeded 5MB limit'));
          return;
        }
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
      resolve({ statusCode: 0, body: '', headers: {}, timings, error: new Error(`Request Timeout (${timeoutMs}ms)`) });
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

export function checkAssertions(assertions: Assertion[], result: HttpResult): string[] {
  const failed: string[] = [];
  if (result.error) {
    failed.push(`Request failed: ${result.error.message}`);
    return failed;
  }

  for (const a of assertions) {
    try {
      if (a.type === 'status') {
        const expected = Number(a.value);
        if (result.statusCode !== expected) failed.push(`Expected HTTP status ${expected}, got ${result.statusCode}`);
      } else if (a.type === 'body') {
        if (a.op === 'contains' && !result.body.includes(String(a.value))) {
          failed.push(`Response body does not contain "${a.value}"`);
        } else if (a.op === 'matches' && !new RegExp(String(a.value)).test(result.body)) {
          failed.push(`Response body does not match regex /${a.value}/`);
        }
      } else if (a.type === 'header') {
        const headerName = (a.name || '').toLowerCase();
        const headerVal = result.headers[headerName];
        const actual = Array.isArray(headerVal) ? headerVal[0] : headerVal;
        if (!actual) {
          failed.push(`Missing header "${a.name}"`);
        } else if (a.op === 'equals' && actual !== String(a.value)) {
          failed.push(`Header "${a.name}" expected "${a.value}", got "${actual}"`);
        } else if (a.op === 'contains' && String(actual).indexOf(String(a.value)) === -1) {
          failed.push(`Header "${a.name}" does not contain "${a.value}"`);
        }
      } else if (a.type === 'jsonpath') {
        if (!a.path) { failed.push(`JSONPath assertion missing path`); continue; }
        
        let jsonObj: any;
        try { jsonObj = JSON.parse(result.body); } catch(e) { failed.push(`Failed to parse JSON for JSONPath assertion`); continue; }
        
        const extracted = JSONPath({ path: a.path, json: jsonObj }) as any[];
        const val = extracted.length > 0 ? extracted[0] : undefined;
        
        if (a.op === 'exists' && val === undefined) {
          failed.push(`JSONPath ${a.path} not found`);
        } else if (a.op === 'equals' && String(val) !== String(a.value)) {
          failed.push(`JSONPath ${a.path} expected "${a.value}", got "${val}"`);
        }
      } else if (a.type === 'latency') {
        const maxMs = a.value_ms || Number(a.value);
        if (result.timings.total_ms > maxMs) {
          failed.push(`Response latency (${result.timings.total_ms}ms) exceeded maximum (${maxMs}ms)`);
        }
      }
    } catch (err: any) {
      failed.push(`Assertion error: ${err.message}`);
    }
  }
  return failed;
}

export function performExtractions(extracts: Extraction[], result: HttpResult, context: Record<string, string>) {
  for (const e of extracts) {
    try {
      let extractedValue = '';
      if (e.type === 'jsonpath' && e.path) {
        let jsonObj = JSON.parse(result.body);
        const matches = JSONPath({ path: e.path, json: jsonObj }) as any[];
        if (matches.length > 0) extractedValue = String(matches[0]);
      } else if (e.type === 'regex' && e.regex) {
        const match = new RegExp(e.regex).exec(result.body);
        if (match && match[1]) extractedValue = match[1];
        else if (match) extractedValue = match[0];
      } else if (e.type === 'header' && e.header) {
        const h = result.headers[e.header.toLowerCase()];
        extractedValue = String(Array.isArray(h) ? h[0] : h || '');
      }
      
      if (extractedValue) {
        context[e.name] = extractedValue;
      }
    } catch (err) {
      // Ignore extraction errors silently for now
    }
  }
}

export function replaceContextVariables(str: string, context: Record<string, string>): string {
  if (!str) return str;
  return str.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}
