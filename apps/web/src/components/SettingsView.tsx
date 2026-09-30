import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Settings, Moon, Sun } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center space-x-3 mb-6">
        <Settings className="w-6 h-6 text-light-textMain dark:text-zinc-100 dark:text-zinc-100" />
        <h1 className="text-2xl font-bold text-light-textMain dark:text-zinc-100 dark:text-zinc-100">Settings</h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-900 border border-light-border dark:border-zinc-800 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-medium text-light-textMain dark:text-zinc-100 dark:text-zinc-100 mb-4">Appearance</h2>
          
          <div className="flex items-center justify-between py-4 border-t border-light-border dark:border-zinc-800 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-light-textMain dark:text-zinc-100 dark:text-zinc-200">Theme Preference</p>
              <p className="text-sm text-light-textMuted dark:text-zinc-400 dark:text-zinc-400 mt-1">Choose between light and dark mode across the application.</p>
            </div>
            
            <div className="flex bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-950 p-1 rounded-lg border border-gray-200 dark:border-zinc-700 dark:border-zinc-800">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  theme === 'light' 
                    ? 'bg-white dark:bg-zinc-900 text-light-textMain dark:text-zinc-100 shadow-sm border border-gray-200 dark:border-zinc-700 dark:border-zinc-800' 
                    : 'text-light-textMuted dark:text-zinc-400 hover:text-light-textMain dark:text-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  theme === 'dark' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700' 
                    : 'text-light-textMuted dark:text-zinc-400 hover:text-light-textMain dark:text-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
