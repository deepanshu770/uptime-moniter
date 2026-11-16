import React, { useState } from 'react';
import { AggregatedLatencyPoint } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { colors } from '../../theme/colors';

interface LatencyBreakdownChartProps {
  data: AggregatedLatencyPoint[];
}

export const LatencyBreakdownChart: React.FC<LatencyBreakdownChartProps> = ({ data }) => {
  const [view, setView] = useState<'stacked' | 'total'>('stacked');
  const { theme } = useTheme();

  const gridColor = theme === 'dark' ? '#262A33' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#86948A' : '#64748B';
  const legendColor = theme === 'dark' ? '#BBCABF' : '#475569';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-low border border-surface-high p-3 rounded-lg shadow-2xl text-xs font-mono">
          <p className="text-on-surface font-semibold mb-2">{new Date(label).toLocaleString()}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <span style={{ color: entry.color }}>{entry.name}</span>
              <span className="text-on-surface font-bold">{entry.value}ms</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface-low border border-surface-border rounded-xl p-4 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface font-semibold">
            Network Latency Decomposition
          </h3>
          <p className="text-[11px] font-mono text-on-surface-muted mt-0.5">
            Phase breakdown from socket initialization to TTFB
          </p>
        </div>

        <div className="flex bg-surface-container rounded-lg p-0.5 border border-surface-high font-mono text-xs">
          <button
            onClick={() => setView('stacked')}
            className={`px-2.5 py-1 rounded transition-colors ${
              view === 'stacked'
                ? 'bg-surface-high text-primary font-semibold'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Phases
          </button>
          <button
            onClick={() => setView('total')}
            className={`px-2.5 py-1 rounded transition-colors ${
              view === 'total'
                ? 'bg-surface-high text-primary font-semibold'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            Total & P95
          </button>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t) =>
                new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              stroke={axisColor}
              fontSize={10}
              tickMargin={8}
            />
            <YAxis stroke={axisColor} fontSize={10} tickFormatter={(v) => `${v}ms`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono',
                paddingTop: '8px',
                color: legendColor
              }}
            />

            {view === 'stacked' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="dns_ms"
                  stackId="1"
                  name="DNS"
                  stroke={colors.timing.dns}
                  fill={colors.timing.dns}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="tcp_ms"
                  stackId="1"
                  name="TCP"
                  stroke={colors.timing.tcp}
                  fill={colors.timing.tcp}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="tls_ms"
                  stackId="1"
                  name="TLS"
                  stroke={colors.timing.tls}
                  fill={colors.timing.tls}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="ttfb_ms"
                  stackId="1"
                  name="TTFB"
                  stroke={colors.timing.ttfb}
                  fill={colors.timing.ttfb}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="download_ms"
                  stackId="1"
                  name="Download"
                  stroke={colors.timing.download}
                  fill={colors.timing.download}
                  fillOpacity={0.6}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="p95_ms"
                  name="P95 Latency"
                  stroke={colors.secondary.amber}
                  fill={colors.secondary.amber}
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="total_ms"
                  name="Avg Total"
                  stroke={colors.primary.DEFAULT}
                  fill={colors.primary.DEFAULT}
                  fillOpacity={0.3}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
