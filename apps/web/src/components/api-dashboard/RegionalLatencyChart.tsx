import React from 'react';
import { RegionalStat } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { colors } from '../../theme/colors';
import { useTheme } from '../../contexts/ThemeContext';

interface RegionalLatencyChartProps {
  data: RegionalStat[];
}

export const RegionalLatencyChart: React.FC<RegionalLatencyChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const gridColor = theme === 'dark' ? '#262A33' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#86948A' : '#64748B';
  const tooltipBg = theme === 'dark' ? '#181C24' : '#FFFFFF';
  const tooltipBorder = theme === 'dark' ? '#31353E' : '#CBD5E1';
  const tooltipText = theme === 'dark' ? '#DFE2EE' : '#0F172A';
  const cursorFill = theme === 'dark' ? '#262A33' : '#F1F5F9';

  return (
    <div className="bg-surface-low border border-surface-border rounded-xl p-4 shadow-md">
      <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface font-semibold mb-4">
        Regional Edge Performance
      </h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="region"
              stroke={axisColor}
              fontSize={10}
              tickMargin={8}
            />
            <YAxis stroke={axisColor} fontSize={10} tickFormatter={(v) => `${v}ms`} />
            <Tooltip
              cursor={{ fill: cursorFill, opacity: 0.5 }}
              contentStyle={{
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                fontSize: '11px',
                color: tooltipText,
                borderRadius: '8px',
                fontFamily: 'JetBrains Mono'
              }}
            />
            <Bar dataKey="avg_latency" name="Avg Latency" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                let barColor: string = colors.status.up;
                if (entry.avg_latency > 300) barColor = colors.status.down;
                else if (entry.avg_latency > 150) barColor = colors.status.degraded;

                return <Cell key={`cell-${index}`} fill={barColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
