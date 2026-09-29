import React from 'react';
import { RefreshCw, Plus, Search, Bell, HelpCircle } from 'lucide-react';
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
  const { user } = useAuth();

  return (
    <header className="border-b border-light-border bg-white sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex-1 flex items-center">
          <div className="max-w-md w-full relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search monitors, incidents..."
              className="block w-full pl-10 pr-3 py-2 border border-light-border rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-light-accent focus:border-light-accent sm:text-sm transition-colors"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">⌘K</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-white text-light-textMuted border-light-border hover:bg-gray-50'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-green-500' : ''}`} />
            <span>{autoRefresh ? 'Live Polling (5s)' : 'Paused'}</span>
          </button>

          {showCreateSampleBtn && (
            <button
              onClick={onCreateSample}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-xs font-medium rounded-lg text-light-textMain border border-light-border transition-colors"
            >
              + Load Preset Targets
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-light-accent hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Monitor</span>
          </button>

          <div className="flex items-center space-x-3 pl-4 border-l border-light-border">
            <button className="text-gray-400 hover:text-gray-500 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
            </button>
            <button className="text-gray-400 hover:text-gray-500">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
