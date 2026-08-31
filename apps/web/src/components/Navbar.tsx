import React from 'react';
import { ShieldCheck, RefreshCw, Plus, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-[#334155] bg-[#0F172A]/80 backdrop-blur-lg sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-[#2563EB]/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-lg text-white tracking-tight">UptimeGuard</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[#2563EB]/10 text-[#3B82F6] border border-[#2563EB]/20">
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
                : 'bg-[#1E293B] text-gray-400 border-[#334155]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>{autoRefresh ? 'Live Polling (5s)' : 'Paused'}</span>
          </button>

          {showCreateSampleBtn && (
            <button
              onClick={onCreateSample}
              className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-xs font-medium rounded-lg text-gray-200 border border-[#334155] transition-colors"
            >
              + Load Preset Targets
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-lg shadow-[#2563EB]/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Monitor</span>
          </button>

          <div className="flex items-center space-x-3 ml-2 pl-4 border-l border-[#334155]">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <User className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline-block truncate max-w-[120px]">{user?.display_name || user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white bg-[#1E293B]/50 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
