import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = (status || '').toUpperCase();
  const pyClass = size === 'sm' ? 'py-0.5' : 'py-1';
  const textClass = size === 'sm' ? 'text-[11px]' : 'text-xs';

  switch (normStatus) {
    case 'UP':
    case 'HEALTHY':
    case 'ACTIVE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 ${pyClass} rounded-full bg-primary/10 text-primary border border-primary/20 font-mono ${textClass} font-semibold tracking-wide`}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(78,222,163,0.9)] animate-pulse" />
          <span>UP</span>
        </span>
      );
    case 'DEGRADED':
    case 'WARNING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 ${pyClass} rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-mono ${textClass} font-semibold tracking-wide`}>
          <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(255,185,95,0.9)]" />
          <span>DEGRADED</span>
        </span>
      );
    case 'DOWN':
    case 'CRITICAL':
    case 'OUTAGE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 ${pyClass} rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 font-mono ${textClass} font-semibold tracking-wide`}>
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-ping" />
          <span>DOWN</span>
        </span>
      );
    case 'SUSPECT':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 ${pyClass} rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono ${textClass} font-semibold tracking-wide`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span>SUSPECT</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 ${pyClass} rounded-full bg-surface-container text-on-surface-variant border border-surface-highest font-mono ${textClass} font-medium`}>
          <span className="w-1.5 h-1.5 rounded-full bg-surface-bright" />
          <span>{normStatus || 'UNKNOWN'}</span>
        </span>
      );
  }
};
