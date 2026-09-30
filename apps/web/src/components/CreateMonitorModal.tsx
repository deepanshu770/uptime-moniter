import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface CreateMonitorModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateMonitorModal: React.FC<CreateMonitorModalProps> = ({ onClose, onCreated }) => {
  const { accessToken } = useAuth();
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('http');
  const [formTarget, setFormTarget] = useState('');
  const [formInterval, setFormInterval] = useState(30);
  const [formTimeout, setFormTimeout] = useState(10000);
  const [formRegions, setFormRegions] = useState<string[]>(['us-east', 'eu-west']);
  const [formMethod, setFormMethod] = useState('GET');
  const [advancedConfig, setAdvancedConfig] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    let parsedConfig = {};
    if (advancedConfig.trim()) {
      try {
        parsedConfig = JSON.parse(advancedConfig);
      } catch (err) {
        setErrorMsg('Invalid JSON in Advanced Configuration');
        setIsSubmitting(false);
        return;
      }
    }
    try {
      const res = await fetch('/v1/monitors', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          name: formName,
          type: formType,
          target: formTarget,
          interval_seconds: Number(formInterval),
          timeout_ms: Number(formTimeout),
          regions: formRegions,
          config: {
            method: formMethod,
            assertions: [{ type: 'status', op: 'equals', value: 200 }],
            ...parsedConfig
          },
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.message || data?.error || 'Failed to create monitor');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-light-border dark:border-zinc-800">
          <h3 className="text-lg font-bold text-light-textMain dark:text-zinc-100 flex items-center space-x-2">
            <Plus className="w-5 h-5 text-light-accent" />
            <span>Create New Monitor</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateMonitor} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Monitor Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Production API Gateway"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Monitor Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
              >
                <option value="http">HTTP(S) Endpoint</option>
                <option value="tcp">TCP Socket / Port</option>
                <option value="dns">DNS Resolution</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">HTTP Method</label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Target Endpoint / URL</label>
            <input
              type="text"
              required
              placeholder="https://api.example.com/health"
              value={formTarget}
              onChange={(e) => setFormTarget(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 font-mono focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Check Interval (sec)</label>
              <select
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
              >
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={formTimeout}
                onChange={(e) => setFormTimeout(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Probing Regions</label>
            <div className="flex space-x-3 pt-1">
              {['us-east', 'eu-west', 'ap-south'].map((reg) => (
                <label key={reg} className="flex items-center space-x-1.5 text-gray-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRegions.includes(reg)}
                    onChange={(e) => {
                      if (e.target.checked) setFormRegions([...formRegions, reg]);
                      else setFormRegions(formRegions.filter((r) => r !== reg));
                    }}
                    className="rounded border-gray-300 text-light-accent focus:ring-light-accent"
                  />
                  <span className="font-mono text-xs">{reg}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Advanced Configuration (JSON DSL)</label>
            <p className="text-gray-500 dark:text-zinc-500 text-[10px] mb-1">Define steps, assertions, and extractions (optional).</p>
            <textarea
              rows={4}
              placeholder='{"assertions": [{"type": "status", "op": "equals", "value": 200}]}'
              value={advancedConfig}
              onChange={(e) => setAdvancedConfig(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-light-border dark:border-zinc-800 rounded-lg px-3 py-2 text-light-textMain dark:text-zinc-100 font-mono focus:outline-none focus:border-light-accent focus:ring-1 focus:ring-light-accent"
            />
          </div>

          <div className="pt-4 border-t border-light-border dark:border-zinc-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-xs font-semibold rounded-lg text-gray-700 dark:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-light-accent hover:bg-indigo-700 text-xs font-semibold rounded-lg text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save & Launch Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
