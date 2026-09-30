import React from 'react';
import { RegionalStat } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RegionalLatencyChartProps {
  data: RegionalStat[];
}

export const RegionalLatencyChart: React.FC<RegionalLatencyChartProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-light-textMain dark:text-zinc-100 mb-6">Regional Performance</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="region" 
              stroke="#52525b"
              fontSize={11}
              tickMargin={10}
            />
            <YAxis stroke="#52525b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
            <Tooltip 
              cursor={{ fill: '#27272a' }}
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '12px', color: '#f4f4f5', borderRadius: '8px' }}
            />
            <Bar dataKey="avg_latency" name="Avg Latency" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                let color = '#10b981'; // Green
                if (entry.avg_latency > 300) color = '#ef4444'; // Red
                else if (entry.avg_latency > 150) color = '#f59e0b'; // Amber
                
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
