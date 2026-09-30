import React, { useState } from 'react';
import { AggregatedLatencyPoint } from './types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LatencyBreakdownChartProps {
  data: AggregatedLatencyPoint[];
}

export const LatencyBreakdownChart: React.FC<LatencyBreakdownChartProps> = ({ data }) => {
  const [view, setView] = useState<'stacked' | 'total'>('stacked');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 p-3 rounded-lg shadow-xl text-xs">
          <p className="text-gray-700 dark:text-zinc-300 font-medium mb-2">{new Date(label).toLocaleString()}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4 mb-1">
              <span style={{ color: entry.color }}>{entry.name}</span>
              <span className="text-light-textMain dark:text-zinc-100 font-medium">{entry.value}ms</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-medium text-light-textMain dark:text-zinc-100">Latency Breakdown</h3>
        <div className="flex bg-light-bg dark:bg-zinc-950 rounded-lg p-0.5 border border-light-border dark:border-zinc-800">
          <button 
            onClick={() => setView('stacked')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${view === 'stacked' ? 'bg-gray-100 dark:bg-zinc-800 text-light-textMain dark:text-zinc-100' : 'text-light-textMuted dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300'}`}
          >
            Network Phases
          </button>
          <button 
            onClick={() => setView('total')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${view === 'total' ? 'bg-gray-100 dark:bg-zinc-800 text-light-textMain dark:text-zinc-100' : 'text-light-textMuted dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300'}`}
          >
            Total & P95
          </button>
        </div>
      </div>
      
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="time" 
              tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#52525b"
              fontSize={11}
              tickMargin={10}
            />
            <YAxis stroke="#52525b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
            
            {view === 'stacked' ? (
              <>
                <Area type="monotone" dataKey="dns_ms" stackId="1" name="DNS" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="tcp_ms" stackId="1" name="TCP" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="tls_ms" stackId="1" name="TLS" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="ttfb_ms" stackId="1" name="TTFB" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                <Area type="monotone" dataKey="download_ms" stackId="1" name="Download" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="p95_ms" name="P95 Latency" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                <Area type="monotone" dataKey="total_ms" name="Avg Total Latency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
