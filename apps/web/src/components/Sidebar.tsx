import React from 'react';
import { LayoutDashboard, Server, AlertTriangle, Activity, Bell, Radio, Settings, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC<{ activeTab: string, setActiveTab: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitors', label: 'Monitors', icon: Server },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'alerting', label: 'Alerting', icon: Bell },
    { id: 'status', label: 'Status Pages', icon: Radio },
  ];

  return (
    <aside className="w-64 bg-light-card border-r border-light-border h-full flex flex-col justify-between hidden md:flex">
      <div>
        <div className="p-4 border-b border-light-border flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-light-accent flex items-center justify-center text-white">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-light-textMain text-sm">Acme Systems</h2>
            <p className="text-xs text-light-textMuted">Pro • 24 monitors</p>
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
                  : 'text-light-textMuted hover:bg-gray-50 hover:text-light-textMain'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-light-border space-y-1">
        <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-light-textMuted hover:bg-gray-50 hover:text-light-textMain transition-colors">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <button onClick={logout} className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-light-textMuted hover:bg-gray-50 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
        <div className="flex items-center space-x-3 px-3 py-2 mt-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-light-textMain truncate w-32">{user?.display_name || user?.email || 'User'}</p>
            <p className="text-xs text-light-textMuted">Workspace owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
