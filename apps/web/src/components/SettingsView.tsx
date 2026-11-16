import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Settings, Moon, Sun, Shield, Sliders } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div className="bg-surface-low border border-surface-border rounded-xl p-6 shadow-md space-y-6">
        <div>
          <h2 className="text-base font-semibold text-on-surface mb-1">Appearance & Telemetry Canvas</h2>
          <p className="text-xs text-on-surface-variant font-mono">
            Configure UI presentation modes and visual telemetry contrast.
          </p>
        </div>

        <div className="flex items-center justify-between py-4 border-t border-surface-border">
          <div>
            <p className="text-sm font-medium text-on-surface">Color Theme</p>
            <p className="text-xs text-on-surface-muted mt-0.5 font-mono">
              Obsidian dark canvas is recommended for high-contrast telemetry charts.
            </p>
          </div>

          <div className="flex bg-surface-container p-1 rounded-lg border border-surface-high font-mono text-xs">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                theme === 'dark'
                  ? 'bg-surface-high text-primary font-semibold shadow-sm'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Obsidian Dark</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                theme === 'light'
                  ? 'bg-surface-high text-primary font-semibold shadow-sm'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-4 border-t border-surface-border">
          <div>
            <p className="text-sm font-medium text-on-surface">Auto-Refresh Cadence</p>
            <p className="text-xs text-on-surface-muted mt-0.5 font-mono">
              Polling frequency for real-time mesh heartbeat and checks stream.
            </p>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-container border border-surface-high text-primary">
            5000 ms (Live Active)
          </span>
        </div>
      </div>
    </div>
  );
};
