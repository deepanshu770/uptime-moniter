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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
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
          },
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0F172A] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Plus className="w-5 h-5 text-blue-500" />
            <span>Create New Monitor</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateMonitor} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-300 font-medium mb-1">Monitor Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Production API Gateway"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-medium mb-1">Monitor Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="http">HTTP(S) Endpoint</option>
                <option value="tcp">TCP Socket / Port</option>
                <option value="dns">DNS Resolution</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 font-medium mb-1">HTTP Method</label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">Target Endpoint / URL</label>
            <input
              type="text"
              required
              placeholder="https://api.example.com/health"
              value={formTarget}
              onChange={(e) => setFormTarget(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-medium mb-1">Check Interval (sec)</label>
              <select
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 font-medium mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={formTimeout}
                onChange={(e) => setFormTimeout(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">Probing Regions</label>
            <div className="flex space-x-3 pt-1">
              {['us-east', 'eu-west', 'ap-south'].map((reg) => (
                <label key={reg} className="flex items-center space-x-1.5 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRegions.includes(reg)}
                    onChange={(e) => {
                      if (e.target.checked) setFormRegions([...formRegions, reg]);
                      else setFormRegions(formRegions.filter((r) => r !== reg));
                    }}
                    className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
                  />
                  <span className="font-mono text-xs">{reg}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-xl text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-xl text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save & Launch Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
