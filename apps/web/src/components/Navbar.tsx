
import React from 'react';
import { ShieldCheck, RefreshCw, Plus } from 'lucide-react';

interface NavbarProps {
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  showCreateSampleBtn: boolean;
  onCreateSample: () => void;
  onOpenCreateModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  autoRefresh,
  setAutoRefresh,
  showCreateSampleBtn,
  onCreateSample,
  onOpenCreateModal
}) => {
  return (
    <header className="border-b border-gray-800/80 bg-gray-900/50 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">UptimeGuard</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Phase 1 MVP
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>{autoRefresh ? 'Live Polling (5s)' : 'Paused'}</span>
          </button>

          {showCreateSampleBtn && (
            <button
              onClick={onCreateSample}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded-lg text-gray-200 border border-gray-700 transition"
            >
              + Load Preset Targets
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Monitor</span>
          </button>
        </div>
      </div>
    </header>
  );
};
