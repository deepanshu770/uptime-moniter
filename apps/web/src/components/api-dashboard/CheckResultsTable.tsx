import React, { useState } from 'react';
import { CheckResult } from './types';
import { ShieldAlert, Globe, Server, Clock } from 'lucide-react';
import { CheckDetailModal } from './CheckDetailModal';

interface CheckResultsTableProps {
  data: CheckResult[];
}

export const CheckResultsTable: React.FC<CheckResultsTableProps> = ({ data }) => {
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckResult | null>(null);

  const filteredData = errorsOnly ? data.filter(d => d.status !== 0) : data;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-light-border dark:border-zinc-800 flex justify-between items-center">
        <h3 className="text-sm font-medium text-light-textMain dark:text-zinc-100">Recent Checks & Incidents</h3>
        <label className="flex items-center space-x-2 text-sm text-light-textMuted dark:text-zinc-400 cursor-pointer">
          <input 
            type="checkbox" 
            className="form-checkbox rounded bg-light-bg dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 text-light-accent focus:ring-0" 
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          <span>Show Errors Only</span>
        </label>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-light-textMuted dark:text-zinc-400">
          <thead className="bg-light-bg dark:bg-zinc-950/50 text-xs uppercase text-gray-400 dark:text-zinc-500 border-b border-light-border dark:border-zinc-800">
            <tr>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-5 py-3 font-medium">Region</th>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Latency</th>
              <th className="px-5 py-3 font-medium">TTFB</th>
              <th className="px-5 py-3 font-medium">Error Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
            {filteredData.slice(0, 15).map((check) => (
              <tr 
                key={check.id} 
                onClick={() => setSelectedCheck(check)}
                className="hover:bg-gray-100 dark:bg-gray-100 dark:bg-zinc-800/50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${check.status === 0 ? 'bg-green-500/10 text-green-400' : check.status === 1 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                    {check.status === 0 ? 'UP' : check.status === 1 ? 'DEGRADED' : 'DOWN'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-700 dark:text-zinc-300">
                  <span title={new Date(check.time).toLocaleString()}>{new Date(check.time).toLocaleTimeString()}</span>
                </td>
                <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
                  <span>{check.region}</span>
                </td>
                <td className="px-5 py-3 font-mono text-gray-700 dark:text-zinc-300">
                  {check.status_code || '-'}
                </td>
                <td className="px-5 py-3 font-mono text-gray-700 dark:text-zinc-300">
                  {check.response_time_ms}ms
                </td>
                <td className="px-5 py-3 font-mono text-gray-400 dark:text-zinc-500">
                  {check.ttfb_ms}ms
                </td>
                <td className="px-5 py-3">
                  {check.error_code ? (
                    <span className="text-red-400 text-xs truncate max-w-[200px] block" title={check.error_message}>
                      {check.error_code}
                    </span>
                  ) : (
                    <span className="text-zinc-600">-</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-zinc-500">
                  No checks found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CheckDetailModal check={selectedCheck} onClose={() => setSelectedCheck(null)} />
    </div>
  );
};
