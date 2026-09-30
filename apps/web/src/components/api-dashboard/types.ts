export interface CheckResult {
  id: string;
  time: string;
  monitor_id: string;
  user_id: string;
  region: string;
  status: number; // 0: UP, 1: DEGRADED, 2: DOWN
  status_code?: number;
  response_time_ms: number;
  dns_ms: number;
  tcp_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  download_ms: number;
  tls_expiry_days?: number;
  error_code?: string;
  error_message?: string;
  attempt: number;
  worker_id: string;
  idempotency_key: string;
}

export interface AggregatedLatencyPoint {
  time: string;
  total_ms: number;
  dns_ms: number;
  tcp_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  download_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface RegionalStat {
  region: string;
  avg_latency: number;
}

export interface MetricSummary {
  uptimePercentage: number;
  uptimeDelta: number;
  avgResponseTime: number;
  latencyDelta: number;
  p95Latency: number;
  p99Latency: number;
  tlsExpiryDays: number | null;
  activeIncidents: number;
  incidentsDelta: number;
}
