import React from 'react';
import { Activity, Server, Zap, AlertTriangle } from 'lucide-react';
import { SystemStats } from '../types';

interface StatsGridProps {
  stats: SystemStats | null;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-light-textMuted dark:text-zinc-400 uppercase tracking-wider">Global Uptime</span>
          <Activity className="w-4 h-4 text-green-500" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-light-textMain dark:text-zinc-100">
            {stats?.uptimePercentage ?? 100}%
          </span>
          <span className="ml-2 text-xs text-green-600 font-medium">SLA Target 99.95%</span>
        </div>
        <div className="w-full bg-gray-200 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats?.uptimePercentage ?? 100}%` }}
          ></div>
        </div>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-light-textMuted dark:text-zinc-400 uppercase tracking-wider">Active Monitors</span>
          <Server className="w-4 h-4 text-light-accent" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-light-textMain dark:text-zinc-100">{stats?.totalMonitors ?? 0}</span>
          <span className="ml-2 text-xs text-light-textMuted dark:text-zinc-400 font-medium">
            {stats?.upCount ?? 0} Healthy
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-4 text-xs text-light-textMuted dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>{stats?.upCount ?? 0} Up</span>
          <span className="w-2 h-2 rounded-full bg-red-500 ml-2"></span>
          <span>{stats?.downCount ?? 0} Down</span>
        </div>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-light-textMuted dark:text-zinc-400 uppercase tracking-wider">Avg Latency</span>
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-light-textMain dark:text-zinc-100">
            {stats?.avgResponseTimeMs ?? 0}
          </span>
          <span className="ml-1 text-sm text-light-textMuted dark:text-zinc-400">ms</span>
        </div>
        <p className="mt-4 text-xs text-light-textMuted dark:text-zinc-400">DNS + TCP + TLS + TTFB</p>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-light-textMuted dark:text-zinc-400 uppercase tracking-wider">Active Incidents</span>
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-light-textMain dark:text-zinc-100">
            {stats?.activeIncidentsCount ?? 0}
          </span>
          <span className="ml-2 text-xs text-red-500 font-medium">Requires Action</span>
        </div>
        <p className="mt-4 text-xs text-light-textMuted dark:text-zinc-400">Multi-region quorum confirmed</p>
      </div>
    </div>
  );
};
