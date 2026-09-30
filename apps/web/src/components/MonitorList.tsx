import React from 'react';
import { Monitor } from '../types';
import { StatusBadge } from './StatusBadge';
import { Play, Trash2, Globe } from 'lucide-react';

interface MonitorListProps {
  monitors: Monitor[];
  executingCheckId: string | null;
  onOpenDetails: (m: Monitor) => void;
  onTriggerCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateSample: () => void;
  onOpenCreateModal: () => void;
}

export const MonitorList: React.FC<MonitorListProps> = ({
  monitors,
  executingCheckId,
  onOpenDetails,
  onTriggerCheck,
  onDelete,
  onCreateSample,
  onOpenCreateModal
}) => {
  if (monitors.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-12 text-center rounded-xl border border-dashed border-light-border dark:border-zinc-800">
        <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-semibold text-light-textMain dark:text-zinc-100">No active monitors configured</h3>
        <p className="text-sm text-light-textMuted dark:text-zinc-400 max-w-md mx-auto mt-1">
          Start watching your endpoints and HTTP/TCP services by creating a new monitor or loading preset targets.
        </p>
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={onCreateSample}
            className="px-4 py-2 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:bg-zinc-800 text-xs font-semibold rounded-lg text-light-textMain dark:text-zinc-100 border border-light-border dark:border-zinc-800 transition-colors"
          >
            Load Sample Targets
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-light-accent hover:bg-indigo-700 text-xs font-semibold rounded-lg text-white shadow-sm transition-colors"
          >
            + Add New Monitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-light-border dark:border-zinc-800 shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-light-border dark:border-zinc-800 text-[11px] font-semibold text-light-textMuted dark:text-zinc-400 uppercase tracking-wider bg-gray-50 dark:bg-zinc-800/50">
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4">Name & Target</th>
            <th className="py-3.5 px-4">Type</th>
            <th className="py-3.5 px-4">Interval</th>
            <th className="py-3.5 px-4">Regions</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-light-border text-sm">
          {monitors.map((m) => (
            <tr
              key={m.id}
              className="hover:bg-gray-50 dark:bg-zinc-800/50 transition cursor-pointer"
              onClick={() => onOpenDetails(m)}
            >
              <td className="py-4 px-4 whitespace-nowrap">
                <StatusBadge status={m.status} />
              </td>
              <td className="py-4 px-4">
                <div className="font-semibold text-light-textMain dark:text-zinc-100 group-hover:text-light-accent transition-colors">
                  {m.name}
                </div>
                <div className="text-xs text-light-textMuted dark:text-zinc-400 font-mono truncate max-w-xs">
                  {m.target}
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="uppercase text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                  {m.type}
                </span>
              </td>
              <td className="py-4 px-4 text-xs text-light-textMain dark:text-zinc-100">
                Every {m.interval_seconds}s
              </td>
              <td className="py-4 px-4">
                <div className="flex space-x-1">
                  {m.regions.map((r) => (
                    <span
                      key={r}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-light-accent border border-indigo-100"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => onTriggerCheck(m.id)}
                    disabled={executingCheckId === m.id}
                    className="p-1.5 text-gray-400 hover:text-light-accent hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Run Immediate Check"
                  >
                    <Play className={`w-4 h-4 ${executingCheckId === m.id ? 'animate-spin text-light-accent' : ''}`} />
                  </button>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Monitor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      </div>
  );
};
