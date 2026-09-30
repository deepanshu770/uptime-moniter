import { CheckResult, AggregatedLatencyPoint, RegionalStat, MetricSummary } from './types';

const generateMockData = () => {
  const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1', 'sa-east-1'];
  const now = Date.now();
  
  const rawChecks: CheckResult[] = [];
  const aggregated: AggregatedLatencyPoint[] = [];
  const regional: Record<string, number[]> = { 'us-east-1': [], 'eu-central-1': [], 'ap-southeast-1': [], 'sa-east-1': [] };

  // Generate 24 hours of data (1 point per hour for aggregated, and multiple raw checks)
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - i * 3600 * 1000).toISOString();
    
    // Base latencies
    let dns = Math.floor(Math.random() * 20) + 5;
    let tcp = Math.floor(Math.random() * 30) + 10;
    let tls = Math.floor(Math.random() * 40) + 20;
    let ttfb = Math.floor(Math.random() * 60) + 30;
    let download = Math.floor(Math.random() * 10) + 2;

    // Simulate an incident 5 hours ago
    const isIncident = i === 5 || i === 4;
    if (isIncident) {
      ttfb += 400;
      tls += 100;
    }

    const total = dns + tcp + tls + ttfb + download;

    aggregated.push({
      time,
      dns_ms: dns,
      tcp_ms: tcp,
      tls_ms: tls,
      ttfb_ms: ttfb,
      download_ms: download,
      total_ms: total,
      p95_ms: total * 1.2,
      p99_ms: total * 1.5,
    });

    regions.forEach((region) => {
      const regionModifier = region === 'ap-southeast-1' ? 1.5 : region === 'sa-east-1' ? 1.8 : 1;
      const rTotal = total * regionModifier;
      regional[region].push(rTotal);
      
      const isError = isIncident && Math.random() > 0.3;
      const status = isError ? 2 : (rTotal > 300 ? 1 : 0);
      const statusCode = isError ? 502 : 200;

      rawChecks.unshift({
        id: `chk_${Math.random().toString(36).substr(2, 9)}`,
        time,
        monitor_id: 'mon_prod_api_1',
        user_id: 'usr_1',
        region,
        status,
        status_code: statusCode,
        response_time_ms: Math.floor(rTotal),
        dns_ms: Math.floor(dns * regionModifier),
        tcp_ms: Math.floor(tcp * regionModifier),
        tls_ms: Math.floor(tls * regionModifier),
        ttfb_ms: Math.floor(ttfb * regionModifier),
        download_ms: Math.floor(download * regionModifier),
        tls_expiry_days: 48,
        attempt: 1,
        worker_id: `wrk_${region}_1`,
        idempotency_key: `idmp_${Math.random().toString(36).substr(2, 9)}`,
        ...(isError && { error_code: 'ERR_BAD_GATEWAY', error_message: '502 Bad Gateway' })
      });
    });
  }

  const regionalStats: RegionalStat[] = regions.map(region => ({
    region,
    avg_latency: Math.floor(regional[region].reduce((a, b) => a + b, 0) / regional[region].length)
  }));

  const summary: MetricSummary = {
    uptimePercentage: 99.94,
    uptimeDelta: 0.02,
    avgResponseTime: 148,
    latencyDelta: -12,
    p95Latency: 280,
    p99Latency: 410,
    tlsExpiryDays: 48,
    activeIncidents: 3,
    incidentsDelta: 2,
  };

  return { rawChecks, aggregated, regionalStats, summary };
};

export const MOCK_DATA = generateMockData();
