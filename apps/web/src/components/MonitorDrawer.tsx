import React, { useState, useEffect } from 'react';
import { Monitor, CheckResult } from '../types';
import { StatusBadge } from './StatusBadge';
import { X, Play, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface MonitorDrawerProps {
  monitor: Monitor | null;
  executingCheckId: string | null;
  onClose: () => void;
  onTriggerCheck: (id: string) => void;
}

export const MonitorDrawer: React.FC<MonitorDrawerProps> = ({
  monitor,
  executingCheckId,
  onClose,
  onTriggerCheck,
}) => {
  const { accessToken } = useAuth();
  const [recentResults, setRecentResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (monitor) {
      setLoading(true);
      fetch(`/v1/monitors/${monitor.id}/results?limit=25`, {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        }
      })
        .then(res => res.json())
        .then(data => {
          if (active) {
            setRecentResults(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error(err);
          if (active) setLoading(false);
        });
    }
    return () => { active = false; };
  }, [monitor, executingCheckId]); // Refetch when executingCheckId changes (probe finishes)

  if (!monitor) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full border-l border-light-border dark:border-zinc-800 p-6 overflow-y-auto space-y-6 flex flex-col justify-between shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-light-border dark:border-zinc-800">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-light-textMain dark:text-zinc-100">{monitor.name}</h2>
                <StatusBadge status={monitor.status} />
              </div>
              <p className="text-xs font-mono text-light-textMuted dark:text-zinc-400 mt-1">{monitor.target}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-100 dark:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-light-border dark:border-zinc-800">
            <div className="text-xs text-light-textMuted dark:text-zinc-400">
              Checking every <span className="text-light-textMain dark:text-zinc-100 font-semibold">{monitor.interval_seconds}s</span> from{' '}
              <span className="text-light-accent">{monitor.regions.join(', ')}</span>
            </div>
            <button
              onClick={() => onTriggerCheck(monitor.id)}
              disabled={executingCheckId === monitor.id}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-light-accent hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Play className={`w-3.5 h-3.5 ${executingCheckId === monitor.id ? 'animate-spin' : ''}`} />
              <span>{executingCheckId === monitor.id ? 'Probing...' : 'Run Probe Now'}</span>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold text-light-textMain dark:text-zinc-100 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-light-accent" />
              <span>Recent Probe Executions & Phase Timings</span>
            </h3>

            {loading && recentResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-light-textMuted dark:text-zinc-400">Loading results...</div>
            ) : recentResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-light-textMuted dark:text-zinc-400">
                No execution results recorded yet. Click "Run Probe Now".
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700">
                    <span className="text-xs font-semibold uppercase tracking-wider block mb-0.5">Total Response Time</span>
                    <span className="text-xl font-bold">{recentResults[0]?.responseTimeMs ?? 0}ms</span>
                  </div>
                </div>
                <div className="h-64 w-full bg-white dark:bg-zinc-900 p-4 rounded-xl border border-light-border dark:border-zinc-800 shadow-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...recentResults].reverse().map(r => ({
                      time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                      DNS: r.timings.dns_ms,
                      TCP: r.timings.tcp_ms,
                      TLS: r.timings.tls_ms,
                      TTFB: r.timings.ttfb_ms,
                      Download: r.timings.download_ms,
                      total: r.responseTimeMs,
                      hasError: r.status !== 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="time" stroke="#6B7280" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#6B7280" fontSize={10} tickFormatter={(val) => `${val}ms`} width={50} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: '0.5rem', fontSize: '12px', color: '#1F2937' }}
                        itemStyle={{ fontSize: '12px' }}
                        cursor={{ fill: '#F3F4F6' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="DNS" stackId="a" fill="#60A5FA" />
                      <Bar dataKey="TCP" stackId="a" fill="#34D399" />
                      <Bar dataKey="TLS" stackId="a" fill="#A78BFA" />
                      <Bar dataKey="TTFB" stackId="a" fill="#FBBF24" />
                      <Bar dataKey="Download" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {typeof recentResults[0]?.tlsExpiryDays === 'number' && (
                  <div className={`p-3 rounded-lg border text-xs font-mono flex items-center space-x-2 ${
                    recentResults[0].tlsExpiryDays <= 7 ? 'bg-red-50 border-red-200 text-red-700' :
                    recentResults[0].tlsExpiryDays <= 30 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                    'bg-green-50 border-green-200 text-green-700'
                  }`}>
                    <span>🔒 TLS Certificate expires in {recentResults[0].tlsExpiryDays} days</span>
                  </div>
                )}

                {recentResults[0]?.errorMessage && (
                  <div className="text-xs text-red-700 font-mono bg-red-50 p-3 rounded-lg border border-red-200">
                    ⚠️ Latest Error: {recentResults[0].errorMessage}
                  </div>
                )}
                
                <div className="mt-6 border border-light-border dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 border-b border-light-border dark:border-zinc-800">
                      <tr>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">Time</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">Status</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">DNS</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">TCP</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">TLS</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">TTFB</th>
                        <th className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border">
                      {recentResults.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:bg-zinc-800/50">
                          <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">{new Date(r.time).toLocaleTimeString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${r.status === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {r.status === 0 ? 'UP' : 'DOWN'}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-zinc-500">{r.timings?.dns_ms ?? 0}ms</td>
                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-zinc-500">{r.timings?.tcp_ms ?? 0}ms</td>
                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-zinc-500">{r.timings?.tls_ms ?? 0}ms</td>
                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-zinc-500">{r.timings?.ttfb_ms ?? 0}ms</td>
                          <td className="px-4 py-2 font-mono text-gray-900 dark:text-zinc-100 font-medium">{r.responseTimeMs ?? 0}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>


              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-light-border dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-xs font-semibold rounded-lg text-gray-700 dark:text-zinc-300 transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
