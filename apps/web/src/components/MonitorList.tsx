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
      <div className="glass-panel p-12 text-center rounded-2xl border-dashed border-gray-700">
        <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-semibold text-gray-200">No active monitors configured</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mt-1">
          Start watching your endpoints and HTTP/TCP services by creating a new monitor or loading preset targets.
        </p>
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={onCreateSample}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-xl text-white border border-gray-700"
          >
            Load Sample Targets
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-xl text-white shadow-lg shadow-blue-600/30"
          >
            + Add New Monitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-gray-800">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/40">
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4">Name & Target</th>
            <th className="py-3.5 px-4">Type</th>
            <th className="py-3.5 px-4">Interval</th>
            <th className="py-3.5 px-4">Regions</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60 text-sm">
          {monitors.map((m) => (
            <tr
              key={m.id}
              className="hover:bg-gray-800/30 transition cursor-pointer"
              onClick={() => onOpenDetails(m)}
            >
              <td className="py-4 px-4 whitespace-nowrap">
                <StatusBadge status={m.status} />
              </td>
              <td className="py-4 px-4">
                <div className="font-semibold text-white group-hover:text-blue-400 transition">
                  {m.name}
                </div>
                <div className="text-xs text-gray-400 font-mono truncate max-w-xs">
                  {m.target}
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="uppercase text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                  {m.type}
                </span>
              </td>
              <td className="py-4 px-4 text-xs text-gray-300">
                Every {m.interval_seconds}s
              </td>
              <td className="py-4 px-4">
                <div className="flex space-x-1">
                  {m.regions.map((r) => (
                    <span
                      key={r}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50"
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
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                    title="Run Immediate Check"
                  >
                    <Play className={`w-4 h-4 ${executingCheckId === m.id ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
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
  );
};
