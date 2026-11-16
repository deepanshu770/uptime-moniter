import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaUnit?: string;
  deltaType?: 'increase_good' | 'decrease_good';
  icon: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  delta,
  deltaUnit = '%',
  deltaType = 'increase_good',
  icon,
}) => {
  const isNeutral = !delta || delta === 0;
  const isPositive = delta !== undefined && delta !== 0 && (deltaType === 'increase_good' ? delta > 0 : delta < 0);

  return (
    <div className="bg-surface-low border border-surface-border rounded-xl p-4 shadow-md flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface-muted">{title}</h3>
        <div className="text-primary p-1.5 rounded-lg bg-surface-container border border-surface-high">
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2 my-1">
        <h2 className="text-2xl font-bold font-mono text-on-surface tracking-tight">{value}</h2>
        {subtitle && <span className="text-xs font-mono text-on-surface-muted">{subtitle}</span>}
      </div>

      {delta !== undefined && (
        <div className="mt-2 pt-2 border-t border-surface-border flex items-center text-[11px] font-mono">
          {isNeutral ? (
            <span className="flex items-center text-on-surface-muted">
              <Minus className="w-3 h-3 mr-1" />
              <span>Steady</span>
            </span>
          ) : (
            <span className={`flex items-center ${isPositive ? 'text-primary' : 'text-tertiary'}`}>
              {delta > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              <span className="font-semibold">{Math.abs(delta)}{deltaUnit}</span>
            </span>
          )}
          <span className="text-on-surface-muted ml-1.5">vs prior window</span>
        </div>
      )}
    </div>
  );
};
