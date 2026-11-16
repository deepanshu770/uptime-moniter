import React from 'react';
import { RefreshCw, Plus, Search, Bell, Menu, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  showCreateSampleBtn: boolean;
  onCreateSample: () => void;
  onOpenCreateModal: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileMenu,
  autoRefresh,
  setAutoRefresh,
  showCreateSampleBtn,
  onCreateSample,
  onOpenCreateModal,
  searchQuery = '',
  onSearchChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 h-16 bg-surface-low/90 backdrop-blur-md border-b border-surface-border px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Search and Mobile Toggle */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full hidden sm:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-on-surface-muted" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search endpoints, hosts, regions..."
            className="w-full bg-surface-container text-on-surface placeholder:text-on-surface-muted text-xs font-mono pl-9 pr-12 py-2 rounded-lg border border-surface-border focus:border-primary/50 focus:outline-none transition-colors"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <kbd className="text-[10px] font-mono text-on-surface-muted bg-surface-high px-1.5 py-0.5 rounded border border-surface-highest">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Action Controls & Indicators */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Live Polling Status */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
            autoRefresh
              ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
              : 'bg-surface-container text-on-surface-muted border-surface-border hover:text-on-surface'
          }`}
          title={autoRefresh ? 'Click to pause auto-polling' : 'Click to enable live 5s polling'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-primary' : ''}`} />
          <span className="hidden sm:inline">{autoRefresh ? 'Live (5s)' : 'Paused'}</span>
        </button>

        {/* Load Preset Demo Targets */}
        {showCreateSampleBtn && (
          <button
            onClick={onCreateSample}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-high text-xs font-mono text-on-surface-variant hover:text-on-surface rounded-lg border border-surface-border transition-colors hidden md:block"
          >
            + Preset Targets
          </button>
        )}

        {/* Create Monitor Button */}
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-light text-black font-semibold text-xs rounded-lg shadow-glow-primary transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Monitor</span>
        </button>

        <div className="h-4 w-px bg-surface-highest mx-1 hidden sm:block" />

        {/* Ingress Gateway / Cluster Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-surface-border text-on-surface-variant text-[11px] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>Mesh Ok</span>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Obsidian Dark'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-secondary hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-primary hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Notification Bell */}
        <button
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface-low" />
        </button>
      </div>
    </header>
  );
};
