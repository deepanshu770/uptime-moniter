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
      <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-zinc-950 text-light-textMuted dark:text-zinc-400">
        <Activity className="w-6 h-6 animate-spin mr-2" />
        <span>Loading telemetry...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-12 text-light-textMuted dark:text-zinc-400 border border-dashed border-light-border dark:border-zinc-800 rounded-xl bg-light-bg dark:bg-zinc-950">
        Failed to load analytics data.
      </div>
    );
  }

  const { summary, aggregated, regionalStats, rawChecks } = data;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
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
            title="Uptime (Selected Window)" 
            value={`${summary.uptimePercentage}%`}
            delta={summary.uptimeDelta}
            deltaType="increase_good"
            icon={<Activity className="w-5 h-5" />}
          />
          <MetricCard 
            title="Avg Response Time" 
            value={`${summary.avgResponseTime} ms`}
            subtitle={`P95: ${summary.p95Latency}ms`}
            delta={summary.latencyDelta}
            deltaType="decrease_good"
            icon={<Clock className="w-5 h-5" />}
          />
          <MetricCard 
            title="SSL / TLS Certificate" 
            value={summary.tlsExpiryDays !== null ? 'Valid' : 'Unknown'}
            subtitle={summary.tlsExpiryDays !== null ? `${summary.tlsExpiryDays} days left` : ''}
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <MetricCard 
            title="Active Failures" 
            value={summary.activeIncidents}
            subtitle="In current window"
            delta={summary.incidentsDelta}
            deltaType="decrease_good"
            icon={<AlertCircle className="w-5 h-5" />}
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
    </div>
  );
};
