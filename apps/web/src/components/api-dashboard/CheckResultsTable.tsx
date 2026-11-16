import React, { useState } from 'react';
import { CheckResult } from './types';
import { Globe, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CheckDetailModal } from './CheckDetailModal';

interface CheckResultsTableProps {
  data: CheckResult[];
}

export const CheckResultsTable: React.FC<CheckResultsTableProps> = ({ data }) => {
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckResult | null>(null);

  const filteredData = errorsOnly ? data.filter((d) => d.status !== 0) : data;

  return (
    <div className="bg-surface-low border border-surface-border rounded-xl overflow-hidden shadow-md">
      <div className="p-4 border-b border-surface-border flex justify-between items-center">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-on-surface font-semibold">
            Raw Probing Trace Log
          </h3>
          <p className="text-[11px] font-mono text-on-surface-muted mt-0.5">
            Click any entry to inspect network socket phases
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-mono text-on-surface-muted hover:text-on-surface cursor-pointer">
          <input
            type="checkbox"
            className="rounded bg-surface-container border-surface-high text-primary focus:ring-0"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          <span>Errors Only</span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-surface-lowest text-[10px] uppercase text-on-surface-muted border-b border-surface-border">
            <tr>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-4 py-2.5">Region</th>
              <th className="px-4 py-2.5">HTTP Code</th>
              <th className="px-4 py-2.5">Total Latency</th>
              <th className="px-4 py-2.5">TTFB</th>
              <th className="px-4 py-2.5">Diagnostics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/60 text-[11px]">
            {filteredData.slice(0, 15).map((check) => (
              <tr
                key={check.id || check.idempotency_key || check.time}
                onClick={() => setSelectedCheck(check)}
                className="hover:bg-surface-high/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      check.status === 0
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : check.status === 1
                        ? 'bg-secondary/10 text-secondary border border-secondary/20'
                        : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        check.status === 0
                          ? 'bg-primary'
                          : check.status === 1
                          ? 'bg-secondary'
                          : 'bg-tertiary'
                      }`}
                    />
                    <span>{check.status === 0 ? 'UP' : check.status === 1 ? 'DEGRADED' : 'DOWN'}</span>
                  </span>
                </td>

                <td className="px-4 py-2.5 text-on-surface-variant whitespace-nowrap">
                  {new Date(check.time).toLocaleTimeString()}
                </td>

                <td className="px-4 py-2.5 text-on-surface whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-on-surface-muted" />
                    <span>{check.region}</span>
                  </div>
                </td>

                <td className="px-4 py-2.5 font-semibold text-on-surface whitespace-nowrap">
                  {check.status_code || '—'}
                </td>

                <td className="px-4 py-2.5 text-on-surface whitespace-nowrap">
                  {check.response_time_ms}ms
                </td>

                <td className="px-4 py-2.5 text-on-surface-muted whitespace-nowrap">
                  {check.ttfb_ms}ms
                </td>

                <td className="px-4 py-2.5 max-w-xs truncate">
                  {check.error_code ? (
                    <span className="text-tertiary font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{check.error_code}</span>
                    </span>
                  ) : (
                    <span className="text-on-surface-muted flex items-center gap-1 text-[10px]">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      <span>Nominal</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-on-surface-muted text-xs">
                  No checks recorded matching filter criteria.
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
