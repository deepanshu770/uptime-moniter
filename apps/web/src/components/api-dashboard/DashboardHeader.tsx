import React from 'react';
import { RefreshCw, Cloud, Calendar } from 'lucide-react';
import { Monitor } from '../../types';

interface DashboardHeaderProps {
  monitors: Monitor[];
  monitorId?: string;
  setMonitorId: (id?: string) => void;
  hours: number;
  setHours: (h: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  monitors,
  monitorId,
  setMonitorId,
  hours,
  setHours,
  refreshing,
  onRefresh,
}) => {
  const selectedMonitor = monitorId ? monitors.find((m) => m.id === monitorId) : null;
  const displayName = selectedMonitor ? selectedMonitor.name : 'Global Infrastructure Telemetry';
  const displayTarget = selectedMonitor ? selectedMonitor.target : 'Aggregated All Probes Mesh';

  return (
    <div className="bg-surface-low p-4 rounded-xl border border-surface-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-container border border-surface-high flex items-center justify-center shrink-0">
          <Cloud className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-on-surface">{displayName}</h2>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container border border-surface-high text-primary">
              Live Feed
            </span>
          </div>
          <p className="text-xs font-mono text-on-surface-muted truncate max-w-md mt-0.5">
            {displayTarget}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Endpoint Selector */}
        <select
          value={monitorId || 'global'}
          onChange={(e) => setMonitorId(e.target.value === 'global' ? undefined : e.target.value)}
          className="bg-surface-container text-on-surface font-mono text-xs px-3 py-1.5 rounded-lg border border-surface-high outline-none cursor-pointer hover:bg-surface-high transition-colors"
        >
          <option value="global">All Endpoints ({monitors.length} Monitored)</option>
          {monitors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Time Window Buttons */}
        <div className="flex bg-surface-container p-0.5 rounded-lg border border-surface-high font-mono text-xs">
          {[
            { label: '24 Hours', value: 24 },
            { label: '7 Days', value: 168 },
            { label: '30 Days', value: 720 },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setHours(item.value)}
              className={`px-2.5 py-1 rounded transition-colors ${
                hours === item.value
                  ? 'bg-surface-high text-primary font-semibold'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-high text-on-surface-variant hover:text-on-surface font-mono text-xs rounded-lg border border-surface-high transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          <span>Sync</span>
        </button>
      </div>
    </div>
  );
};
