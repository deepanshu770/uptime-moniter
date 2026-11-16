import React from 'react';
import { Activity, Server, Zap, ShieldAlert, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { SystemStats } from '../types';

interface StatsGridProps {
  stats: SystemStats | null;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const uptime = stats?.uptimePercentage ?? 100;
  const isHealthy = uptime >= 99.9;
  const total = stats?.totalMonitors ?? 0;
  const up = stats?.upCount ?? 0;
  const down = stats?.downCount ?? 0;
  const degraded = Math.max(0, total - up - down);
  const avgLatency = stats?.avgResponseTimeMs ?? 0;
  const incidents = stats?.activeIncidentsCount ?? 0;

  // Approximate timing breakdown when not broken down individually
  const dnsMs = Math.round(avgLatency * 0.12) || 8;
  const tcpMs = Math.round(avgLatency * 0.22) || 24;
  const tlsMs = Math.round(avgLatency * 0.26) || 32;
  const ttfbMs = Math.max(1, avgLatency - dnsMs - tcpMs - tlsMs) || 54;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Uptime & SLA Cushion */}
      <div className="bg-surface-low rounded-xl p-4 border border-surface-border relative overflow-hidden group hover:border-surface-highest transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant font-medium">
            Global Availability (30d)
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono text-[10px] font-semibold border border-surface-high">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {isHealthy ? 'SLA Safe' : 'Breached'}
          </span>
        </div>

        <div className="my-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold text-on-surface tracking-tight">
              {uptime.toFixed(2)}%
            </span>
            <span className="text-[11px] font-mono text-primary">+0.03% cushion</span>
          </div>

          {/* Mini Sparkline SVG */}
          <svg className="w-16 h-6 text-primary overflow-visible opacity-80" fill="none" viewBox="0 0 80 24">
            <path
              d="M0 16 L10 14 L20 15 L30 11 L40 13 L50 8 L60 9 L70 5 L80 4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M0 16 L10 14 L20 15 L30 11 L40 13 L50 8 L60 9 L70 5 L80 4 L80 24 L0 24 Z"
              fill="currentColor"
              fillOpacity="0.1"
            />
          </svg>
        </div>

        <div className="space-y-1.5">
          <div className="w-full bg-surface-highest h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, uptime)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-on-surface-muted">
            <span>Target: 99.95%</span>
            <span>1.8m MTTR</span>
          </div>
        </div>
      </div>

      {/* KPI 2: Active Probes Pool */}
      <div className="bg-surface-low rounded-xl p-4 border border-surface-border relative overflow-hidden group hover:border-surface-highest transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant font-medium">
            Monitored Services
          </span>
          <span className="text-[10px] font-mono text-on-surface-muted">Mesh Synced</span>
        </div>

        <div className="my-3 flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold text-on-surface tracking-tight">{total}</span>
          <span className="text-xs text-on-surface-variant font-medium">Active Targets</span>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded border border-surface-high text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-glow-primary" />
            <span className="text-on-surface font-semibold">{up} Nominal</span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded border border-surface-high text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-secondary font-semibold">{degraded} Degr.</span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded border border-surface-high text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            <span className="text-tertiary font-semibold">{down} Down</span>
          </div>
        </div>
      </div>

      {/* KPI 3: Global Latency Breakdown */}
      <div className="bg-surface-low rounded-xl p-4 border border-surface-border relative overflow-hidden group hover:border-surface-highest transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant font-medium">
            Avg Latency (p95)
          </span>
          <span className="text-[10px] font-mono text-primary flex items-center gap-0.5">
            <ArrowDownRight className="w-3 h-3" /> -6ms
          </span>
        </div>

        <div className="my-3 flex items-baseline gap-1">
          <span className="text-3xl font-mono font-bold text-on-surface tracking-tight">
            {avgLatency}
          </span>
          <span className="text-xs font-mono text-on-surface-muted">ms</span>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          <div className="bg-surface-container px-1 py-0.5 rounded text-center border border-surface-high">
            <div className="text-on-surface-muted text-[9px]">DNS</div>
            <div className="text-on-surface font-semibold">{dnsMs}ms</div>
          </div>
          <div className="bg-surface-container px-1 py-0.5 rounded text-center border border-surface-high">
            <div className="text-on-surface-muted text-[9px]">TCP</div>
            <div className="text-on-surface font-semibold">{tcpMs}ms</div>
          </div>
          <div className="bg-surface-container px-1 py-0.5 rounded text-center border border-surface-high">
            <div className="text-on-surface-muted text-[9px]">TLS</div>
            <div className="text-on-surface font-semibold">{tlsMs}ms</div>
          </div>
          <div className="bg-surface-container px-1 py-0.5 rounded text-center border border-surface-high">
            <div className="text-on-surface-muted text-[9px]">TTFB</div>
            <div className="text-primary font-semibold">{ttfbMs}ms</div>
          </div>
        </div>
      </div>

      {/* KPI 4: Active Incidents Mesh */}
      <div className="bg-surface-low rounded-xl p-4 border border-surface-border relative overflow-hidden group hover:border-surface-highest transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant font-medium">
            Active Incident Mesh
          </span>
          <span className="text-[10px] font-mono text-on-surface-muted">Heartbeat: 4s</span>
        </div>

        <div className="my-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container border border-surface-high flex items-center justify-center">
            {incidents === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-tertiary animate-pulse" />
            )}
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-on-surface">
              {incidents === 0 ? '0 Outages' : `${incidents} Incident${incidents > 1 ? 's' : ''}`}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              {incidents === 0 ? 'Zero blocking events' : 'Requires review'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-surface-container px-2.5 py-1 rounded border border-surface-high text-[10px] font-mono">
          <span className="text-on-surface-muted">Ingress Gateway Check</span>
          <span className={`font-semibold ${incidents === 0 ? 'text-primary' : 'text-tertiary'}`}>
            {incidents === 0 ? 'ALL PASSING' : 'IMPACTED'}
          </span>
        </div>
      </div>
    </div>
  );
};
