import React from 'react';
import { Incident, Monitor } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface IncidentListProps {
  incidents: Incident[];
  monitors: Monitor[];
  onAcknowledge: (id: string) => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({ incidents, monitors, onAcknowledge }) => {
  if (incidents.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">No Incidents Detected</h3>
        <p className="text-sm text-gray-400 mt-1">All monitored systems operating normally.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((inc) => (
        <div
          key={inc.id}
          className={`glass-panel p-5 rounded-2xl border flex items-center justify-between ${
            inc.status === 'resolved'
              ? 'border-gray-800 opacity-75'
              : 'border-rose-500/40 bg-rose-500/5'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span
                className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                  inc.status === 'resolved'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400 animate-pulse'
                }`}
              >
                {inc.status}
              </span>
              <span className="font-semibold text-white text-base">
                {monitors.find((m) => m.id === inc.monitor_id)?.name || 'Monitor Incident'}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                Root region: {inc.root_cause_region || 'us-east'}
              </span>
            </div>
            <p className="text-xs text-gray-300 font-mono">
              {inc.error_summary || 'Target check failed or timed out'}
            </p>
            <p className="text-[11px] text-gray-400">
              Started: {new Date(inc.started_at).toLocaleString()}
              {inc.resolved_at && ` • Resolved: ${new Date(inc.resolved_at).toLocaleString()}`}
            </p>
          </div>

          {inc.status !== 'resolved' && (
            <button
              onClick={() => onAcknowledge(inc.id)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow"
            >
              Acknowledge & Resolve
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
