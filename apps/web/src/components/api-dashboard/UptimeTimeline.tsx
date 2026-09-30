import React from 'react';
import { AggregatedLatencyPoint } from './types';

interface UptimeTimelineProps {
  data: AggregatedLatencyPoint[];
}

export const UptimeTimeline: React.FC<UptimeTimelineProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-light-textMain dark:text-zinc-100">24-Hour Availability</h3>
        <span className="text-xs text-green-500 font-medium">99.94% Uptime</span>
      </div>
      
      <div className="flex items-stretch h-12 w-full gap-0.5 relative group">
        {data.map((point, i) => {
          // Simulate state: total > 300 = yellow, total > 500 = red (incidents)
          let colorClass = 'bg-green-500';
          if (point.total_ms > 500) colorClass = 'bg-red-500';
          else if (point.total_ms > 300) colorClass = 'bg-amber-500';

          return (
            <div 
              key={i} 
              className={`flex-1 rounded-sm ${colorClass} hover:opacity-80 cursor-pointer relative`}
              title={`${new Date(point.time).toLocaleTimeString()} - Avg: ${point.total_ms}ms`}
            >
              {/* Tooltip on hover (Browser native title is used above for simplicity, could do custom tooltip) */}
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between text-xs text-gray-400 dark:text-zinc-500 mt-2">
        <span>24 hours ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};
