import React from 'react';
import { X, Clock, Globe, ShieldAlert, Cpu, AlertTriangle } from 'lucide-react';
import { CheckResult } from './types';

interface CheckDetailModalProps {
  check: CheckResult | null;
  onClose: () => void;
}

export const CheckDetailModal: React.FC<CheckDetailModalProps> = ({ check, onClose }) => {
  if (!check) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-zinc-800 bg-gray-50 dark:bg-white dark:bg-zinc-900/50">
          <h2 className="text-lg font-bold text-light-textMain dark:text-zinc-100 flex items-center">
            Execution Inspection
            <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${check.status === 0 ? 'bg-green-500/20 text-green-400' : check.status === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
              {check.status === 0 ? 'UP' : check.status === 1 ? 'DEGRADED' : 'DOWN'}
            </span>
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-light-textMuted dark:text-zinc-400 hover:text-light-textMain dark:text-zinc-100 hover:bg-gray-100 dark:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {check.error_code && (
            <div className="mb-6 p-4 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-red-400">{check.error_code}</h4>
                <p className="text-sm text-red-300 mt-1">{check.error_message}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-light-bg dark:bg-zinc-950 border border-light-border dark:border-zinc-800">
              <div className="flex items-center space-x-2 text-light-textMuted dark:text-zinc-400 mb-1">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-medium">Region & Worker</span>
              </div>
              <p className="text-sm text-light-textMain dark:text-zinc-100 font-medium">{check.region}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono mt-1">{check.worker_id}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-light-bg dark:bg-zinc-950 border border-light-border dark:border-zinc-800">
              <div className="flex items-center space-x-2 text-light-textMuted dark:text-zinc-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Timestamp</span>
              </div>
              <p className="text-sm text-light-textMain dark:text-zinc-100 font-medium">{new Date(check.time).toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono mt-1">Attempt: {check.attempt}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-light-textMain dark:text-zinc-100 mb-4 border-b border-light-border dark:border-zinc-800 pb-2">Network Timing Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'DNS Lookup', value: check.dns_ms, color: 'bg-emerald-500' },
              { label: 'TCP Connect', value: check.tcp_ms, color: 'bg-blue-500' },
              { label: 'TLS Handshake', value: check.tls_ms, color: 'bg-purple-500' },
              { label: 'TTFB', value: check.ttfb_ms, color: 'bg-amber-500' },
              { label: 'Content Download', value: check.download_ms, color: 'bg-red-500' },
            ].map((phase) => (
              <div key={phase.label} className="flex items-center text-sm">
                <div className="w-40 text-light-textMuted dark:text-zinc-400 font-medium">{phase.label}</div>
                <div className="w-16 text-right font-mono text-light-textMain dark:text-zinc-100">{phase.value}ms</div>
                <div className="flex-1 ml-4 bg-light-bg dark:bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${phase.color}`} style={{ width: `${Math.min(100, (phase.value / check.response_time_ms) * 100)}%` }}></div>
                </div>
              </div>
            ))}
            <div className="flex items-center text-sm pt-2 mt-2 border-t border-gray-100 dark:border-light-border dark:border-zinc-800/50">
              <div className="w-40 text-light-textMain dark:text-zinc-100 font-bold">Total Latency</div>
              <div className="w-16 text-right font-mono text-light-textMain dark:text-zinc-100 font-bold">{check.response_time_ms}ms</div>
              <div className="flex-1 ml-4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
