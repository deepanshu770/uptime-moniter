import React from 'react';
import { CheckResult } from './types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface StatusCodeChartProps {
  data: CheckResult[];
}

export const StatusCodeChart: React.FC<StatusCodeChartProps> = ({ data }) => {
  // Aggregate data
  const counts: Record<string, number> = { '2xx': 0, '4xx': 0, '5xx': 0, 'Network Error': 0 };
  
  data.forEach(check => {
    if (!check.status_code) {
      counts['Network Error']++;
    } else if (check.status_code >= 200 && check.status_code < 300) {
      counts['2xx']++;
    } else if (check.status_code >= 400 && check.status_code < 500) {
      counts['4xx']++;
    } else if (check.status_code >= 500) {
      counts['5xx']++;
    } else {
      counts['Network Error']++;
    }
  });

  const chartData = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  const COLORS: Record<string, string> = {
    '2xx': '#10b981',
    '4xx': '#f59e0b',
    '5xx': '#ef4444',
    'Network Error': '#6b7280'
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-light-textMain dark:text-zinc-100 mb-2">Status Codes</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#ffffff'} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#f4f4f5' }}
              itemStyle={{ color: '#f4f4f5' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
