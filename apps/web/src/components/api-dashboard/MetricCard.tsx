import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaType?: 'increase_good' | 'decrease_good';
  icon: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, delta, deltaType = 'increase_good', icon }) => {
  let isPositive = false;
  let isNeutral = !delta || delta === 0;

  if (delta && delta !== 0) {
    if (deltaType === 'increase_good') {
      isPositive = delta > 0;
    } else {
      isPositive = delta < 0;
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-light-textMuted dark:text-zinc-400">{title}</h3>
        <div className="text-gray-400 dark:text-zinc-500">{icon}</div>
      </div>
      <div className="flex items-baseline space-x-2">
        <h2 className="text-2xl font-bold text-light-textMain dark:text-zinc-100">{value}</h2>
        {subtitle && <span className="text-xs text-gray-400 dark:text-zinc-500">{subtitle}</span>}
      </div>
      
      {delta !== undefined && (
        <div className="mt-4 flex items-center text-xs">
          {isNeutral ? (
            <span className="flex items-center text-gray-400 dark:text-zinc-500">
              <Minus className="w-3 h-3 mr-1" />
              <span>No change</span>
            </span>
          ) : (
            <span className={`flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {delta > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              <span className="font-medium">{Math.abs(delta)}%</span>
            </span>
          )}
          <span className="text-gray-400 dark:text-zinc-500 ml-2">vs last period</span>
        </div>
      )}
    </div>
  );
};
