import React, { useState, useMemo } from 'react';
import { Monitor } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  Play,
  Trash2,
  Lock,
  Globe,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Download,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface MonitorListProps {
  monitors: Monitor[];
  executingCheckId: string | null;
  onOpenDetails: (m: Monitor) => void;
  onTriggerCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateSample: () => void;
  onOpenCreateModal: () => void;
  viewMode?: 'matrix' | 'cards';
  onViewModeChange?: (mode: 'matrix' | 'cards') => void;
}

export const MonitorList: React.FC<MonitorListProps> = ({
  monitors,
  executingCheckId,
  onOpenDetails,
  onTriggerCheck,
  onDelete,
  onCreateSample,
  onOpenCreateModal,
  viewMode: propViewMode,
  onViewModeChange,
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [internalViewMode, setInternalViewMode] = useState<'matrix' | 'cards'>('matrix');
  const viewMode = propViewMode || internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;

  // Filtered monitors list
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const matchesText =
        !filterText ||
        m.name.toLowerCase().includes(filterText.toLowerCase()) ||
        m.target.toLowerCase().includes(filterText.toLowerCase());

      const matchesStatus =
        selectedStatus === 'all' ||
        (m.status || '').toUpperCase() === selectedStatus.toUpperCase();

      const matchesRegion =
        selectedRegion === 'all' ||
        m.regions.some((r) => r.toLowerCase().includes(selectedRegion.toLowerCase()));

      return matchesText && matchesStatus && matchesRegion;
    });
  }, [monitors, filterText, selectedStatus, selectedRegion]);

  // CSV Export utility
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Type', 'Target', 'Status', 'Interval (s)', 'Regions'];
    const rows = filteredMonitors.map((m) => [
      m.id,
      `"${m.name.replace(/"/g, '""')}"`,
      m.type || 'HTTP',
      `"${m.target.replace(/"/g, '""')}"`,
      m.status,
      m.interval_seconds,
      `"${m.regions.join(';')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monitors_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (monitors.length === 0) {
    return (
      <div className="bg-surface-low p-12 text-center rounded-xl border border-dashed border-surface-border shadow-lg">
        <div className="w-14 h-14 rounded-full bg-surface-container border border-surface-high flex items-center justify-center mx-auto mb-4">
          <Globe className="w-7 h-7 text-primary animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-on-surface">No Active Probes Configured</h3>
        <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1 font-mono">
          Initialize telemetry monitoring across your APIs and microservices by loading preset edge targets or creating a custom probe.
        </p>
        <div className="mt-6 flex justify-center items-center gap-3">
          <button
            onClick={onCreateSample}
            className="px-4 py-2 bg-surface-container hover:bg-surface-high text-xs font-mono font-medium rounded-lg text-on-surface border border-surface-high transition-colors"
          >
            + Load Preset Targets
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-black text-xs font-semibold rounded-lg shadow-glow-primary transition-all active:scale-95"
          >
            Create New Monitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tactical Operational Filter Bar */}
      <div className="bg-surface-low p-3 rounded-xl border border-surface-border flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shadow-md">
        {/* Left: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Live Search */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Filter className="w-3.5 h-3.5 text-on-surface-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by name, target or host..."
              className="w-full bg-surface-container text-on-surface placeholder:text-on-surface-muted font-mono text-xs pl-8 pr-3 py-1.5 rounded-lg border border-surface-high focus:border-primary/50 outline-none transition-colors"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-surface-container text-on-surface font-mono text-xs px-3 py-1.5 rounded-lg border border-surface-high outline-none cursor-pointer hover:bg-surface-high transition-colors"
          >
            <option value="all">All Statuses ({monitors.length})</option>
            <option value="UP">UP Nominal</option>
            <option value="DEGRADED">Degraded Latency</option>
            <option value="DOWN">Down / Failing</option>
          </select>

          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-surface-container text-on-surface font-mono text-xs px-3 py-1.5 rounded-lg border border-surface-high outline-none cursor-pointer hover:bg-surface-high transition-colors"
          >
            <option value="all">Region: Global Mesh</option>
            <option value="us-east">Americas (us-east)</option>
            <option value="eu-west">Europe (eu-west)</option>
            <option value="ap-southeast">Asia-Pacific (ap-se)</option>
          </select>
        </div>

        {/* Right: View Modes & Bulk Actions */}
        <div className="flex items-center gap-2 justify-between xl:justify-end">
          {/* Table vs Grid Toggle */}
          <div className="bg-surface-container p-0.5 rounded-lg border border-surface-high flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-surface-high text-primary font-semibold'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-surface-high text-primary font-semibold'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <div className="h-4 w-px bg-surface-highest hidden sm:block" />

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            type="button"
            className="bg-surface-container hover:bg-surface-high text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 border border-surface-high transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' ? (
        <div className="bg-surface-low rounded-xl border border-surface-border overflow-hidden shadow-lg">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest text-on-surface-muted font-mono text-[11px] uppercase tracking-wider border-b border-surface-border">
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 min-w-[260px]">Service & Target</th>
                  <th className="py-3 px-4">Cadence</th>
                  <th className="py-3 px-4">Edge Regions</th>
                  <th className="py-3 px-4">Protocol</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/60 text-xs">
                {filteredMonitors.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onOpenDetails(m)}
                    className="hover:bg-surface-high/30 transition-colors cursor-pointer group"
                  >
                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={m.status} size="sm" />
                    </td>

                    {/* Service & Target */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-on-surface group-hover:text-primary transition-colors text-sm">
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-on-surface-muted font-mono text-[11px] truncate max-w-sm">
                          <Lock className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{m.target}</span>
                        </div>
                      </div>
                    </td>

                    {/* Cadence */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container border border-surface-high text-on-surface">
                        {m.interval_seconds}s
                      </span>
                    </td>

                    {/* Regions */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {m.regions.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container border border-surface-high text-primary"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-container border border-surface-high text-on-surface-variant font-medium">
                        {m.type || 'HTTP'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onTriggerCheck(m.id)}
                          disabled={executingCheckId === m.id}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-high rounded-lg transition-colors"
                          title="Instant Probe Check"
                        >
                          <Play
                            className={`w-4 h-4 ${
                              executingCheckId === m.id ? 'animate-spin text-primary' : ''
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => onDelete(m.id)}
                          className="p-1.5 text-on-surface-variant hover:text-tertiary hover:bg-surface-high rounded-lg transition-colors"
                          title="Delete Target"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenDetails(m)}
                          className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-high rounded-lg transition-colors"
                          title="Open Telemetry Drawer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMonitors.map((m) => (
            <div
              key={m.id}
              onClick={() => onOpenDetails(m)}
              className="bg-surface-low rounded-xl p-4 border border-surface-border hover:border-surface-highest hover:bg-surface-high/20 transition-all cursor-pointer group shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                    {m.name}
                  </span>
                  <StatusBadge status={m.status} size="sm" />
                </div>

                <div className="flex items-center gap-1.5 text-on-surface-muted font-mono text-[11px] truncate mb-3">
                  <Lock className="w-3 h-3 text-primary shrink-0" />
                  <span className="truncate">{m.target}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-surface-container border border-surface-high text-on-surface">
                    {m.interval_seconds}s interval
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container border border-surface-high text-primary uppercase">
                    {m.type}
                  </span>
                  {m.regions.map((r) => (
                    <span
                      key={r}
                      className="px-1.5 py-0.5 rounded bg-surface-container border border-surface-high text-on-surface-variant"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] font-mono text-on-surface-muted">
                  ID: {m.id.substring(0, 8)}...
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onTriggerCheck(m.id)}
                    disabled={executingCheckId === m.id}
                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-high rounded-lg transition-colors"
                    title="Instant Probe"
                  >
                    <Play
                      className={`w-3.5 h-3.5 ${
                        executingCheckId === m.id ? 'animate-spin text-primary' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="p-1.5 text-on-surface-variant hover:text-tertiary hover:bg-surface-high rounded-lg transition-colors"
                    title="Delete Monitor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
