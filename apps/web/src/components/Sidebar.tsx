import React from 'react';
import { LayoutDashboard, Server, AlertCircle, BarChart2, AlertTriangle, Activity, Bell, Radio, Settings, User, LogOut, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC<{ activeTab: string, setActiveTab: (tab: string) => void, isMobileMenuOpen?: boolean, closeMobileMenu?: () => void }> = ({ activeTab, setActiveTab, isMobileMenuOpen, closeMobileMenu }) => {
  const { user, logout } = useAuth();

  
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitors', label: 'Monitors', icon: Activity },
    { id: 'incidents', label: 'Incidents', icon: AlertCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];


  return (
    <>
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden transition-opacity" 
          onClick={closeMobileMenu}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-light-card border-r border-light-border dark:border-zinc-800 h-full flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {isMobileMenuOpen && (
          <div className="absolute top-0 right-0 -mr-12 pt-2 md:hidden">
            <button
              onClick={closeMobileMenu}
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        )}
      <div>
        <div className="p-4 border-b border-light-border dark:border-zinc-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-light-accent flex items-center justify-center text-white">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-light-textMain dark:text-zinc-100 text-sm">Acme Systems</h2>
            <p className="text-xs text-light-textMuted dark:text-zinc-400">Pro • 24 monitors</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-light-accent'
                  : 'text-light-textMuted dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800/50 hover:text-light-textMain dark:text-zinc-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-light-border dark:border-zinc-800 space-y-1">
        <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-light-textMuted dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800/50 hover:text-light-textMain dark:text-zinc-100 transition-colors">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <button onClick={logout} className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-light-textMuted dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-800/50 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
        <div className="flex items-center space-x-3 px-3 py-2 mt-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 dark:text-zinc-500">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-light-textMain dark:text-zinc-100 dark:text-zinc-200 truncate w-32">{user?.display_name || user?.email || 'User'}</p>
            <p className="text-xs text-light-textMuted dark:text-zinc-400">Workspace owner</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};
