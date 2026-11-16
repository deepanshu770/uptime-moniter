import React, { useState, useEffect } from 'react';
import { Monitor, CheckResult } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  X,
  Play,
  Activity,
  Copy,
  ExternalLink,
  Clock,
  Globe,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
import { colors } from '../theme/colors';

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
  const { theme } = useTheme();
  const [recentResults, setRecentResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const gridColor = theme === 'dark' ? '#262A33' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#86948A' : '#64748B';
  const tooltipBg = theme === 'dark' ? '#181C24' : '#FFFFFF';
  const tooltipBorder = theme === 'dark' ? '#31353E' : '#CBD5E1';
  const tooltipText = theme === 'dark' ? '#DFE2EE' : '#0F172A';
  const legendColor = theme === 'dark' ? '#BBCABF' : '#475569';

  useEffect(() => {
    let active = true;
    if (monitor) {
      setLoading(true);
      fetch(`/v1/monitors/${monitor.id}/results?limit=20`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (active) {
            setRecentResults(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch probe results:', err);
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [monitor, executingCheckId]);

  if (!monitor) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(monitor.target);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const chartData = [...recentResults].reverse().map((r) => ({
    time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    DNS: r.timings?.dns_ms ?? 0,
    TCP: r.timings?.tcp_ms ?? 0,
    TLS: r.timings?.tls_ms ?? 0,
    TTFB: r.timings?.ttfb_ms ?? 0,
    total: r.responseTimeMs ?? 0,
    status: r.status,
  }));

  const latestResult = recentResults[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-low h-full border-l border-surface-border p-6 overflow-y-auto space-y-6 flex flex-col justify-between shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Header & Sub-nav */}
          <div className="flex items-start justify-between pb-4 border-b border-surface-border">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-on-surface-muted text-[11px] font-mono">
                <span>MONITORS & PROBES</span>
                <span>/</span>
                <span className="text-primary uppercase">{monitor.type || 'HTTP'}</span>
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-on-surface tracking-tight truncate">
                  {monitor.name}
                </h2>
                <StatusBadge status={monitor.status} size="sm" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-on-surface-muted hover:text-on-surface hover:bg-surface-high rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Endpoint URL & Instant Actions Bar */}
          <div className="bg-surface-container rounded-xl p-3 border border-surface-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-xs font-mono text-on-surface truncate select-all">
                {monitor.target}
              </code>
              <button
                onClick={handleCopyUrl}
                className="text-on-surface-muted hover:text-primary transition-colors p-1"
                title="Copy target URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {monitor.target.startsWith('http') && (
                <a
                  href={monitor.target}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-on-surface-muted hover:text-primary transition-colors p-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <button
              onClick={() => onTriggerCheck(monitor.id)}
              disabled={executingCheckId === monitor.id}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-light text-black text-xs font-mono font-semibold rounded-lg shadow-glow-primary transition-all shrink-0 active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 ${executingCheckId === monitor.id ? 'animate-spin' : ''}`} />
              <span>{executingCheckId === monitor.id ? 'Probing...' : 'Instant Probe'}</span>
            </button>
          </div>

          {/* Telemetry Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container p-3 rounded-lg border border-surface-high">
              <div className="text-[10px] font-mono text-on-surface-muted uppercase">Last Latency</div>
              <div className="text-lg font-bold font-mono text-on-surface mt-0.5">
                {latestResult ? `${latestResult.responseTimeMs}ms` : '—'}
              </div>
            </div>
            <div className="bg-surface-container p-3 rounded-lg border border-surface-high">
              <div className="text-[10px] font-mono text-on-surface-muted uppercase">Interval</div>
              <div className="text-lg font-bold font-mono text-on-surface mt-0.5">
                {monitor.interval_seconds}s
              </div>
            </div>
            <div className="bg-surface-container p-3 rounded-lg border border-surface-high">
              <div className="text-[10px] font-mono text-on-surface-muted uppercase">Edge Mesh</div>
              <div className="text-lg font-bold font-mono text-primary mt-0.5">
                {monitor.regions.length} Regions
              </div>
            </div>
          </div>

          {/* Phase Timings Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-on-surface flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span>Phase Breakdown (DNS, TCP, TLS, TTFB)</span>
              </h3>
            </div>

            {loading && recentResults.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs font-mono text-on-surface-muted bg-surface-container rounded-xl border border-surface-high">
                Loading telemetry samples...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs font-mono text-on-surface-muted bg-surface-container rounded-xl border border-surface-high">
                No probe executions recorded yet. Click "Instant Probe" above.
              </div>
            ) : (
              <div className="h-56 w-full bg-surface-container p-3 rounded-xl border border-surface-high">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="time" stroke={axisColor} fontSize={10} tickLine={false} />
                    <YAxis stroke={axisColor} fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        color: tooltipText
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        paddingTop: '6px',
                        color: legendColor
                      }}
                    />
                    <Bar dataKey="DNS" stackId="a" fill={colors.timing.dns} />
                    <Bar dataKey="TCP" stackId="a" fill={colors.timing.tcp} />
                    <Bar dataKey="TLS" stackId="a" fill={colors.timing.tls} />
                    <Bar dataKey="TTFB" stackId="a" fill={colors.timing.ttfb} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Historical Execution Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-on-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-on-surface-variant" />
              <span>Probe Execution Stream</span>
            </h3>

            <div className="bg-surface-container rounded-xl border border-surface-high overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-surface-lowest text-[10px] uppercase text-on-surface-muted border-b border-surface-high">
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Region</th>
                      <th className="py-2 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-high/50 text-[11px]">
                    {recentResults.map((r, index) => (
                      <tr key={r.jobId || `${r.time}-${index}`} className="hover:bg-surface-high/30 transition-colors">
                        <td className="py-2 px-3">
                          <span
                            className={`w-2 h-2 rounded-full inline-block ${
                              r.status === 0 ? 'bg-primary' : 'bg-tertiary'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 text-on-surface font-semibold">
                          {r.statusCode || '—'}
                        </td>
                        <td className="py-2 px-3 text-on-surface">
                          {r.responseTimeMs}ms
                        </td>
                        <td className="py-2 px-3 text-primary">
                          {r.region}
                        </td>
                        <td className="py-2 px-3 text-right text-on-surface-muted">
                          {new Date(r.time).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                    {recentResults.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-on-surface-muted text-xs">
                          No probe logs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs font-mono text-on-surface-muted">
          <span>Target ID: {monitor.id}</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-high text-on-surface rounded-lg border border-surface-high transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
