import React, { useState } from 'react';
import { Activity, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { DashboardHeader } from './DashboardHeader';
import { MetricCard } from './MetricCard';
import { UptimeTimeline } from './UptimeTimeline';
import { LatencyBreakdownChart } from './LatencyBreakdownChart';
import { RegionalLatencyChart } from './RegionalLatencyChart';
import { StatusCodeChart } from './StatusCodeChart';
import { CheckResultsTable } from './CheckResultsTable';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalyticsData } from '../../hooks/useAnalyticsData';
import { Monitor } from '../../types';

interface ApiMonitoringDashboardProps {
  monitors: Monitor[];
}

export const ApiMonitoringDashboard: React.FC<ApiMonitoringDashboardProps> = ({ monitors }) => {
  const { accessToken } = useAuth();
  const [hours, setHours] = useState(24);
  const [monitorId, setMonitorId] = useState<string | undefined>(undefined);

  const { data, loading, refresh } = useAnalyticsData(accessToken, hours, monitorId);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-16 text-on-surface-muted font-mono text-xs">
        <Activity className="w-5 h-5 animate-spin mr-2 text-primary" />
        <span>Aggregating global telemetry stream...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-12 text-on-surface-muted border border-dashed border-surface-border rounded-xl bg-surface-low font-mono text-xs">
        Telemetry stream offline or uninitialized.
      </div>
    );
  }

  const { summary, aggregated, regionalStats, rawChecks } = data;

  return (
    <div className="space-y-6">
      <DashboardHeader
        monitors={monitors}
        monitorId={monitorId}
        setMonitorId={setMonitorId}
        hours={hours}
        setHours={setHours}
        refreshing={loading}
        onRefresh={refresh}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Availability SLA"
          value={`${summary.uptimePercentage}%`}
          delta={summary.uptimeDelta}
          deltaType="increase_good"
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          title="Avg Latency (Global)"
          value={`${summary.avgResponseTime}ms`}
          subtitle={`p95: ${summary.p95Latency}ms`}
          delta={summary.latencyDelta}
          deltaUnit="ms"
          deltaType="decrease_good"
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          title="Edge TLS Certificate"
          value={summary.tlsExpiryDays !== null ? 'Valid' : 'Verified'}
          subtitle={summary.tlsExpiryDays !== null ? `${summary.tlsExpiryDays}d valid` : 'Active'}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <MetricCard
          title="Active Failures"
          value={summary.activeIncidents}
          subtitle="In window"
          delta={summary.incidentsDelta}
          deltaUnit=""
          deltaType="decrease_good"
          icon={<AlertCircle className="w-4 h-4" />}
        />
      </div>

      {aggregated && aggregated.length > 0 && <UptimeTimeline data={aggregated} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LatencyBreakdownChart data={aggregated || []} />
        </div>
        <div className="space-y-6">
          <StatusCodeChart data={rawChecks || []} />
          <RegionalLatencyChart data={regionalStats || []} />
        </div>
      </div>

      <CheckResultsTable data={rawChecks || []} />
    </div>
  );
};
