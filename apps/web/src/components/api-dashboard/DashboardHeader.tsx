import React from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
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
  monitors, monitorId, setMonitorId, hours, setHours, refreshing, onRefresh 
}) => {
  const selectedMonitor = monitorId ? monitors.find(m => m.id === monitorId) : null;
  const displayName = selectedMonitor ? selectedMonitor.name : 'Global Infrastructure';
  const displayUrl = selectedMonitor ? selectedMonitor.target : 'Aggregated View';

  // Find worst status for global view, or current monitor status
  let statusBadge = { color: 'bg-green-500', pulse: 'bg-green-400' };
  if (selectedMonitor) {
    if (selectedMonitor.status === 'DOWN') { statusBadge = { color: 'bg-red-500', pulse: 'bg-red-400' }; }
    else if (selectedMonitor.status === 'DEGRADED') { statusBadge = { color: 'bg-amber-500', pulse: 'bg-amber-400' }; }
  } else {
    if (monitors.some(m => m.status === 'DOWN')) { statusBadge = { color: 'bg-red-500', pulse: 'bg-red-400' }; }
    else if (monitors.some(m => m.status === 'DEGRADED')) { statusBadge = { color: 'bg-amber-500', pulse: 'bg-amber-400' }; }
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center space-x-3">
          <div className="flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-3 w-3 rounded-full ${statusBadge.pulse} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${statusBadge.color}`}></span>
          </div>
          <h1 className="text-2xl font-bold text-light-textMain dark:text-zinc-100">{displayName}</h1>
        </div>
        <p className="text-sm text-light-textMuted dark:text-zinc-400 mt-1">{displayUrl}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
        <select
          value={monitorId || 'global'}
          onChange={(e) => setMonitorId(e.target.value === 'global' ? undefined : e.target.value)}
          className="block w-48 pl-3 pr-10 py-1.5 text-sm border border-light-border dark:border-zinc-800 rounded-lg leading-5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-light-accent focus:border-light-accent transition-colors"
        >
          <option value="global">All Monitors (Global)</option>
          {monitors.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <div className="flex items-center space-x-1 bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg p-1">
          {[24, 168, 720].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                hours === h ? 'bg-gray-100 dark:bg-zinc-800 text-light-textMain dark:text-zinc-100' : 'text-light-textMuted dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
              }`}
            >
              {h === 24 ? '24H' : h === 168 ? '7D' : '30D'}
            </button>
          ))}
        </div>
        
        <button 
          onClick={onRefresh}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
