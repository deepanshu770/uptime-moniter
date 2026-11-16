import React from 'react';
import { X, Clock, Globe, AlertTriangle } from 'lucide-react';
import { CheckResult } from './types';
import { colors } from '../../theme/colors';

interface CheckDetailModalProps {
  check: CheckResult | null;
  onClose: () => void;
}

export const CheckDetailModal: React.FC<CheckDetailModalProps> = ({ check, onClose }) => {
  if (!check) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-low border border-surface-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-container">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-on-surface">Execution Trace Inspection</h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                check.status === 0
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : check.status === 1
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
              }`}
            >
              {check.status === 0 ? 'UP 200' : check.status === 1 ? 'DEGRADED' : 'DOWN'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-muted hover:text-on-surface hover:bg-surface-high rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {check.error_code && (
            <div className="p-3 rounded-lg bg-tertiary/10 border border-tertiary/20 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-tertiary">{check.error_code}</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">{check.error_message}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-container border border-surface-high">
              <div className="flex items-center gap-1.5 text-on-surface-muted mb-1 text-[11px]">
                <Globe className="w-3.5 h-3.5" />
                <span>Region & Worker</span>
              </div>
              <p className="text-on-surface font-semibold">{check.region}</p>
              <p className="text-[10px] text-on-surface-muted truncate mt-0.5">{check.worker_id}</p>
            </div>

            <div className="p-3 rounded-lg bg-surface-container border border-surface-high">
              <div className="flex items-center gap-1.5 text-on-surface-muted mb-1 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Probe Timestamp</span>
              </div>
              <p className="text-on-surface font-semibold">{new Date(check.time).toLocaleTimeString()}</p>
              <p className="text-[10px] text-on-surface-muted mt-0.5">Attempt: {check.attempt}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface mb-3 border-b border-surface-high pb-1.5">
              Network Phase Decomposition
            </h3>
            <div className="space-y-2.5 text-xs">
              {[
                { label: 'DNS Resolution', value: check.dns_ms ?? 0, color: colors.timing.dns },
                { label: 'TCP Handshake', value: check.tcp_ms ?? 0, color: colors.timing.tcp },
                { label: 'TLS Negotiation', value: check.tls_ms ?? 0, color: colors.timing.tls },
                { label: 'Time to First Byte (TTFB)', value: check.ttfb_ms ?? 0, color: colors.timing.ttfb },
                { label: 'Body Stream Download', value: check.download_ms ?? 0, color: colors.timing.download },
              ].map((phase) => (
                <div key={phase.label} className="flex items-center gap-3">
                  <div className="w-44 text-on-surface-variant text-[11px] truncate">{phase.label}</div>
                  <div className="w-14 text-right font-semibold text-on-surface">{phase.value}ms</div>
                  <div className="flex-1 bg-surface-container rounded-full h-1.5 overflow-hidden border border-surface-high">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: phase.color,
                        width: `${Math.min(100, Math.max(2, ((phase.value || 0) / Math.max(1, check.response_time_ms || 1)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-surface-high font-bold text-xs">
                <span className="text-on-surface">Total Latency</span>
                <span className="text-primary">{check.response_time_ms}ms</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-surface-container border-t border-surface-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-surface-high hover:bg-surface-highest text-on-surface text-xs rounded-lg transition-colors"
          >
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
};
