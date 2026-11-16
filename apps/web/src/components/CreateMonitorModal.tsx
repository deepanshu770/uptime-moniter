import React, { useState } from 'react';
import { Plus, X, Globe, Shield, Terminal } from 'lucide-react';
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

  const toggleRegion = (r: string) => {
    if (formRegions.includes(r)) {
      if (formRegions.length > 1) {
        setFormRegions(formRegions.filter((x) => x !== r));
      }
    } else {
      setFormRegions([...formRegions, r]);
    }
  };

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    let parsedConfig = {};
    if (advancedConfig.trim()) {
      try {
        parsedConfig = JSON.parse(advancedConfig);
      } catch {
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
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
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
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-low border border-surface-border rounded-xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center border border-surface-high">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-bold text-on-surface">Deploy New Probe Target</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-muted hover:text-on-surface hover:bg-surface-high rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-tertiary/10 border border-tertiary/20 rounded-lg p-3 text-tertiary text-xs font-mono">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateMonitor} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-on-surface-variant mb-1 font-sans font-medium">
              Monitor Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Production Ingress Gateway"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface placeholder:text-on-surface-muted focus:border-primary/50 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-on-surface-variant mb-1 font-sans font-medium">
                Probe Protocol
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface focus:border-primary/50 outline-none cursor-pointer"
              >
                <option value="http">HTTP / HTTPS</option>
                <option value="tcp">TCP Socket</option>
              </select>
            </div>

            <div>
              <label className="block text-on-surface-variant mb-1 font-sans font-medium">
                HTTP Method
              </label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                disabled={formType === 'tcp'}
                className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface focus:border-primary/50 outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-on-surface-variant mb-1 font-sans font-medium">
              Endpoint Target URL
            </label>
            <input
              type="text"
              required
              placeholder="https://api.example.com/healthz"
              value={formTarget}
              onChange={(e) => setFormTarget(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface placeholder:text-on-surface-muted focus:border-primary/50 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-on-surface-variant mb-1 font-sans font-medium">
                Cadence Interval
              </label>
              <select
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface focus:border-primary/50 outline-none cursor-pointer"
              >
                <option value={10}>Every 10 seconds (Fast)</option>
                <option value={30}>Every 30 seconds (Standard)</option>
                <option value={60}>Every 60 seconds (Passive)</option>
                <option value={120}>Every 2 minutes</option>
                <option value={300}>Every 5 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-on-surface-variant mb-1 font-sans font-medium">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={60000}
                step={500}
                value={formTimeout}
                onChange={(e) => setFormTimeout(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface focus:border-primary/50 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-on-surface-variant mb-1.5 font-sans font-medium">
              Edge Probe PoP Regions
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'us-east', label: 'US-East (Virginia)' },
                { id: 'eu-west', label: 'EU-West (Frankfurt)' },
                { id: 'ap-southeast', label: 'AP-SE (Singapore)' }
              ].map((r) => {
                const active = formRegions.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRegion(r.id)}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all ${
                      active
                        ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                        : 'bg-surface-container border-surface-high text-on-surface-muted hover:border-surface-highest'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{r.id}</div>
                    <div className="text-[9px] text-on-surface-muted truncate">{r.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-on-surface-variant mb-1 font-sans font-medium">
              Advanced Headers / Assertions (JSON)
            </label>
            <textarea
              rows={2}
              placeholder='{ "headers": { "Authorization": "Bearer token" } }'
              value={advancedConfig}
              onChange={(e) => setAdvancedConfig(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-surface-high rounded-lg text-on-surface font-mono placeholder:text-on-surface-muted focus:border-primary/50 outline-none text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-high text-on-surface-variant hover:text-on-surface rounded-lg transition-colors border border-surface-high font-sans text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary hover:bg-primary-light text-black font-semibold rounded-lg shadow-glow-primary transition-all disabled:opacity-50 font-sans text-xs"
            >
              {isSubmitting ? 'Provisioning...' : 'Deploy Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
