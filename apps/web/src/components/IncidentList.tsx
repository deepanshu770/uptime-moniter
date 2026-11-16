import React from 'react';
import { Incident, Monitor } from '../types';
import { CheckCircle2, AlertTriangle, ShieldCheck, Clock, MapPin } from 'lucide-react';

interface IncidentListProps {
  incidents: Incident[];
  monitors: Monitor[];
  onAcknowledge: (id: string) => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({ incidents, monitors, onAcknowledge }) => {
  if (incidents.length === 0) {
    return (
      <div className="bg-surface-low p-12 text-center rounded-xl border border-surface-border shadow-lg">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-on-surface">Zero Active Incidents</h3>
        <p className="text-xs text-on-surface-muted max-w-md mx-auto mt-1 font-mono">
          All synthetic probes and edge health checks are operating within normal SLA thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((inc) => {
        const isResolved = inc.status === 'resolved';
        const monitor = monitors.find((m) => m.id === inc.monitor_id);

        return (
          <div
            key={inc.id}
            className={`p-4 rounded-xl border transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isResolved
                ? 'bg-surface-low border-surface-border opacity-70'
                : 'bg-surface-low border-tertiary/40 shadow-glow-tertiary'
            }`}
          >
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                    isResolved
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-tertiary/10 text-tertiary border border-tertiary/30 animate-pulse'
                  }`}
                >
                  {inc.status}
                </span>

                <span className="font-semibold text-sm text-on-surface truncate">
                  {monitor?.name || 'Target Service Incident'}
                </span>

                <div className="flex items-center gap-1 text-[11px] font-mono text-on-surface-muted">
                  <MapPin className="w-3 h-3 text-secondary" />
                  <span>{inc.root_cause_region || 'global-mesh'}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-on-surface-muted">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-on-surface-muted" />
                  <span>Started {new Date(inc.started_at).toLocaleTimeString()}</span>
                </div>
                {inc.resolved_at && (
                  <div className="flex items-center gap-1 text-primary">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Resolved {new Date(inc.resolved_at).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>

            {inc.status === 'acknowledged' ? (
              <span className="px-3 py-1.5 bg-surface-container text-xs font-mono text-primary rounded-lg border border-surface-high self-start sm:self-center shrink-0 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Acknowledged</span>
              </span>
            ) : !isResolved ? (
              <button
                onClick={() => onAcknowledge(inc.id)}
                className="px-3 py-1.5 bg-surface-container hover:bg-surface-high text-xs font-mono text-on-surface rounded-lg border border-surface-high transition-colors self-start sm:self-center shrink-0"
              >
                Acknowledge Alert
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
