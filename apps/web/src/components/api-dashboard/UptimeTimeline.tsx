import React from 'react';
import { AggregatedLatencyPoint } from './types';

interface UptimeTimelineProps {
  data: AggregatedLatencyPoint[];
}

export const UptimeTimeline: React.FC<UptimeTimelineProps> = ({ data }) => {
  return (
    <div className="bg-surface-low border border-surface-border rounded-xl p-4 shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface font-semibold">
          24-Hour Telemetry Availability Mesh
        </h3>
        <span className="text-xs font-mono text-primary font-semibold">99.98% Operational</span>
      </div>

      <div className="flex items-stretch h-8 w-full gap-0.5 relative group bg-surface-container p-1 rounded-lg border border-surface-high">
        {data.map((point, i) => {
          let colorClass = 'bg-primary';
          if (point.total_ms > 500) colorClass = 'bg-tertiary';
          else if (point.total_ms > 300) colorClass = 'bg-secondary';

          return (
            <div
              key={i}
              className={`flex-1 rounded-sm ${colorClass} hover:opacity-80 cursor-pointer transition-opacity`}
              title={`${new Date(point.time).toLocaleTimeString()} — Avg: ${point.total_ms}ms`}
            />
          );
        })}
        {data.length === 0 && (
          <div className="w-full flex items-center justify-center text-xs font-mono text-on-surface-muted">
            Collecting telemetry checkpoints...
          </div>
        )}
      </div>

      <div className="flex justify-between text-[10px] font-mono text-on-surface-muted mt-2">
        <span>-24 Hours</span>
        <span>Mesh Current</span>
      </div>
    </div>
  );
};
