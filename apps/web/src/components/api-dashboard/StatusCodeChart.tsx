import React from 'react';
import { CheckResult } from './types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { colors } from '../../theme/colors';
import { useTheme } from '../../contexts/ThemeContext';

interface StatusCodeChartProps {
  data: CheckResult[];
}

export const StatusCodeChart: React.FC<StatusCodeChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const strokeColor = theme === 'dark' ? '#181C24' : '#FFFFFF';
  const tooltipBg = theme === 'dark' ? '#181C24' : '#FFFFFF';
  const tooltipBorder = theme === 'dark' ? '#31353E' : '#CBD5E1';
  const tooltipText = theme === 'dark' ? '#DFE2EE' : '#0F172A';
  const legendColor = theme === 'dark' ? '#BBCABF' : '#475569';

  const counts: Record<string, number> = { '2xx OK': 0, '4xx Client': 0, '5xx Server': 0, 'Network Error': 0 };

  data.forEach((check) => {
    if (!check.status_code) {
      counts['Network Error']++;
    } else if (check.status_code >= 200 && check.status_code < 300) {
      counts['2xx OK']++;
    } else if (check.status_code >= 400 && check.status_code < 500) {
      counts['4xx Client']++;
    } else if (check.status_code >= 500) {
      counts['5xx Server']++;
    } else {
      counts['Network Error']++;
    }
  });

  const chartData = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  const COLOR_MAP: Record<string, string> = {
    '2xx OK': colors.status.up,
    '4xx Client': colors.status.degraded,
    '5xx Server': colors.status.down,
    'Network Error': colors.text.muted,
  };

  return (
    <div className="bg-surface-low border border-surface-border rounded-xl p-4 shadow-md">
      <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface font-semibold mb-2">
        HTTP Status Distribution
      </h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.length ? chartData : [{ name: '2xx OK', value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || colors.primary.DEFAULT} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderRadius: '8px',
                color: tooltipText,
                fontSize: '11px',
                fontFamily: 'JetBrains Mono'
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono',
                color: legendColor
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
