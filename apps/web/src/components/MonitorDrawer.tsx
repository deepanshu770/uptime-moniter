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
            setRecentResults(data);
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-[#0F172A] h-full border-l border-gray-800 p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-white">{monitor.name}</h2>
                <StatusBadge status={monitor.status} />
              </div>
              <p className="text-xs font-mono text-gray-400 mt-1">{monitor.target}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-800">
            <div className="text-xs text-gray-400">
              Checking every <span className="text-white font-semibold">{monitor.interval_seconds}s</span> from{' '}
              <span className="text-blue-400">{monitor.regions.join(', ')}</span>
            </div>
            <button
              onClick={() => onTriggerCheck(monitor.id)}
              disabled={executingCheckId === monitor.id}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow"
            >
              <Play className={`w-3.5 h-3.5 ${executingCheckId === monitor.id ? 'animate-spin' : ''}`} />
              <span>{executingCheckId === monitor.id ? 'Probing...' : 'Run Probe Now'}</span>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-300 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Recent Probe Executions & Phase Timings</span>
            </h3>

            {loading && recentResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">Loading results...</div>
            ) : recentResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No execution results recorded yet. Click "Run Probe Now".
              </div>
            ) : (
              <div className="h-64 w-full bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...recentResults].reverse().map(r => ({
                    time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    DNS: r.timings.dns_ms,
                    TCP: r.timings.tcp_ms,
                    TLS: r.timings.tls_ms,
                    TTFB: r.timings.ttfb_ms,
                    total: r.responseTimeMs,
                    hasError: r.status !== 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickMargin={10} />
                    <YAxis stroke="#9CA3AF" fontSize={10} tickFormatter={(val) => `${val}ms`} width={50} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                      cursor={{ fill: '#374151', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="DNS" stackId="a" fill="#60A5FA" />
                    <Bar dataKey="TCP" stackId="a" fill="#34D399" />
                    <Bar dataKey="TLS" stackId="a" fill="#A78BFA" />
                    <Bar dataKey="TTFB" stackId="a" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {recentResults[0]?.errorMessage && (
                  <div className="mt-4 text-xs text-rose-400 font-mono bg-rose-950/30 p-3 rounded-lg border border-rose-900/50">
                    ⚠️ Latest Error: {recentResults[0].errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-xl text-gray-300"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
