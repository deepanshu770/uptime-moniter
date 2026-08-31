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
          <span className="text-xs font-medium text-gray-400">Global Uptime</span>
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-white">
            {stats?.uptimePercentage ?? 100}%
          </span>
          <span className="ml-2 text-xs text-emerald-400 font-medium">SLA Target 99.95%</span>
        </div>
        <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats?.uptimePercentage ?? 100}%` }}
          ></div>
        </div>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Active Monitors</span>
          <Server className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-white">{stats?.totalMonitors ?? 0}</span>
          <span className="ml-2 text-xs text-gray-400 font-medium">
            {stats?.upCount ?? 0} Healthy
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-4 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{stats?.upCount ?? 0} Up</span>
          <span className="w-2 h-2 rounded-full bg-rose-400 ml-2"></span>
          <span>{stats?.downCount ?? 0} Down</span>
        </div>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Avg Latency</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-white">
            {stats?.avgResponseTimeMs ?? 0}
          </span>
          <span className="ml-1 text-sm text-gray-400">ms</span>
        </div>
        <p className="mt-4 text-xs text-gray-400">DNS + TCP + TLS + TTFB</p>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Active Incidents</span>
          <AlertTriangle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-3xl font-extrabold text-white">
            {stats?.activeIncidentsCount ?? 0}
          </span>
          <span className="ml-2 text-xs text-rose-400 font-medium">Requires Action</span>
        </div>
        <p className="mt-4 text-xs text-gray-400">Multi-region quorum confirmed</p>
      </div>
    </div>
  );
};
