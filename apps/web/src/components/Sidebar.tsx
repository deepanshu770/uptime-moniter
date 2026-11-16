import React from 'react';
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  AlertTriangle,
  Settings,
  LogOut,
  X,
  Radio,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen?: boolean;
  closeMobileMenu?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  closeMobileMenu,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitors', label: 'Monitors', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-low border-r border-surface-border flex flex-col justify-between transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col">
          {/* Header & Brand */}
          <div className="p-4 flex items-center justify-between border-b border-surface-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center border border-surface-high">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base tracking-tight text-on-surface">Pulse</span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-primary/20 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-primary bg-surface-container px-1.5 py-0.5 rounded border border-surface-high">
                v2.4
              </span>
              {isMobileMenuOpen && (
                <button
                  onClick={closeMobileMenu}
                  className="md:hidden text-on-surface-variant hover:text-on-surface"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-black font-semibold shadow-glow-primary'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black/60" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Global Mesh Status & User Footer */}
        <div className="p-4 border-t border-surface-border space-y-3">
          {/* Edge Mesh Status Pill */}
          <div className="p-2.5 rounded-lg bg-surface-container border border-surface-high flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-xs text-on-surface-variant">Edge PoPs</span>
            </div>
            <span className="text-[11px] font-mono font-medium text-primary">28 Active</span>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase">
                {user?.display_name ? user.display_name[0] : (user?.email ? user.email[0] : 'U')}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-on-surface truncate">
                  {user?.display_name || user?.email || 'Admin'}
                </p>
                <p className="text-[10px] text-on-surface-muted truncate">Workspace Owner</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-tertiary hover:bg-surface-high transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
