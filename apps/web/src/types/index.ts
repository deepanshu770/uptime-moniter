export interface Monitor {
  id: string;
  name: string;
  type: string;
  target: string;
  interval_seconds: number;
  timeout_ms: number;
  regions: string[];
  enabled: boolean;
  status: 'UP' | 'SUSPECT' | 'DOWN' | 'DEGRADED' | 'RECOVERING';
  lastCheckedAt?: string;
  config: any;
}

export interface CheckResult {
  jobId: string;
  time: string;
  status: number;
  statusCode?: number;
  responseTimeMs: number;
  timings: {
    dns_ms: number;
    tcp_ms: number;
    tls_ms: number;
    ttfb_ms: number;
    total_ms: number;
  };
  region: string;
  errorMessage?: string;
}

export interface Incident {
  id: string;
  monitor_id: string;
  status: string;
  severity: string;
  started_at: string;
  resolved_at?: string;
  root_cause_region?: string;
  error_summary?: string;
}

export interface SystemStats {
  totalMonitors: number;
  upCount: number;
  downCount: number;
  activeIncidentsCount: number;
  avgResponseTimeMs: number;
  uptimePercentage: number;
}
