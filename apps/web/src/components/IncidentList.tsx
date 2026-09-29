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
      <div className="bg-white p-12 text-center rounded-xl border border-light-border shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-light-textMain">No Incidents Detected</h3>
        <p className="text-sm text-light-textMuted mt-1">All monitored systems operating normally.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((inc) => (
        <div
          key={inc.id}
          className={`bg-white p-5 rounded-xl border flex items-center justify-between shadow-sm ${
            inc.status === 'resolved'
              ? 'border-light-border opacity-75'
              : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span
                className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                  inc.status === 'resolved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700 animate-pulse'
                }`}
              >
                {inc.status}
              </span>
              <span className="font-semibold text-light-textMain text-base">
                {monitors.find((m) => m.id === inc.monitor_id)?.name || 'Monitor Incident'}
              </span>
              <span className="text-xs text-light-textMuted font-mono">
                Root region: {inc.root_cause_region || 'us-east'}
              </span>
            </div>
            <p className="text-xs text-light-textMain font-mono">
              {inc.error_summary || 'Target check failed or timed out'}
            </p>
            <p className="text-[11px] text-light-textMuted">
              Started: {new Date(inc.started_at).toLocaleString()}
              {inc.resolved_at && ` • Resolved: ${new Date(inc.resolved_at).toLocaleString()}`}
            </p>
          </div>

          {inc.status !== 'resolved' && (
            <button
              onClick={() => onAcknowledge(inc.id)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Acknowledge & Resolve
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
