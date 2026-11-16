import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { StatsGrid } from '../components/StatsGrid';
import { MonitorList } from '../components/MonitorList';
import { Analytics } from '../components/Analytics';
import { SettingsView } from '../components/SettingsView';
import { IncidentList } from '../components/IncidentList';
import { MonitorDrawer } from '../components/MonitorDrawer';
import { CreateMonitorModal } from '../components/CreateMonitorModal';
import { Monitor } from '../types';

export default function Dashboard() {
  const { accessToken, logout } = useAuth();
  const {
    stats,
    monitors,
    autoRefresh,
    setAutoRefresh,
    fetchData,
    triggerManualCheck,
    deleteMonitor,
    createSampleMonitors,
  } = useDashboardData(accessToken, logout);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'monitors';
  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const viewMode = (searchParams.get('view') as 'matrix' | 'cards') || 'matrix';
  const setViewMode = (mode: 'matrix' | 'cards') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      return next;
    });
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executingCheckId, setExecutingCheckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  // Deep-link sync: monitorId param in URL opens details drawer
  const monitorIdParam = searchParams.get('monitorId');
  React.useEffect(() => {
    if (monitorIdParam && monitors.length > 0) {
      const found = monitors.find((m) => m.id === monitorIdParam);
      if (found) {
        setSelectedMonitor(found);
      }
    }
  }, [monitorIdParam, monitors]);

  const handleOpenDetails = (m: Monitor) => {
    setSelectedMonitor(m);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('monitorId', m.id);
      return next;
    });
  };

  const handleCloseDetails = () => {
    setSelectedMonitor(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('monitorId');
      return next;
    });
  };

  const isCreateModalOpen = showCreateModal || searchParams.get('create') === 'true';
  const handleOpenCreateModal = () => setShowCreateModal(true);
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    if (searchParams.get('create')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      });
    }
  };

  // Derive incidents from failing or degraded monitors
  const incidents = monitors
    .filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED')
    .map((m) => ({
      id: `inc-${m.id}`,
      monitor_id: m.id,
      status: acknowledgedIds.has(`inc-${m.id}`) ? 'acknowledged' : m.status === 'DOWN' ? 'outage' : 'degraded',
      severity: m.status === 'DOWN' ? 'critical' : 'warning',
      started_at: m.lastCheckedAt || new Date().toISOString(),
      root_cause_region: m.regions[0] || 'us-east',
      error_summary: `${m.name} enters ${m.status} status`,
    }));

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => new Set(prev).add(id));
  };

  const handleTriggerCheck = (monitorId: string) => {
    triggerManualCheck(monitorId, setExecutingCheckId, () => {
      // Monitor drawer will auto-refetch via executingCheckId dependency
    });
  };

  const handleDeleteMonitor = (monitorId: string) => {
    deleteMonitor(monitorId, () => {
      if (selectedMonitor?.id === monitorId) {
        setSelectedMonitor(null);
      }
    });
  };

  return (
    <div className="h-screen flex overflow-hidden bg-canvas text-on-surface">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(t) => {
          setActiveTab(t);
          setIsMobileMenuOpen(false);
        }}
        isMobileMenuOpen={isMobileMenuOpen}
        closeMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          showCreateSampleBtn={monitors.length === 0}
          onCreateSample={createSampleMonitors}
          onOpenCreateModal={handleOpenCreateModal}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Context Sub-header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-on-surface capitalize">
                  {activeTab === 'overview'
                    ? 'Cockpit Overview'
                    : activeTab === 'monitors'
                    ? 'Production Matrix & Probes'
                    : activeTab === 'analytics'
                    ? 'Telemetry Analytics'
                    : activeTab === 'incidents'
                    ? 'Active Incidents & Alerts'
                    : activeTab === 'settings'
                    ? 'Preferences & Settings'
                    : 'Telemetry Console'}
                </h1>
                <p className="text-xs text-on-surface-muted font-mono mt-0.5">
                  {activeTab === 'monitors'
                    ? 'Synthetic monitoring of distributed APIs, TCP services, and microservice meshes.'
                    : activeTab === 'analytics'
                    ? 'Global network latency breakdown, regional distribution, and SLA adherence.'
                    : activeTab === 'incidents'
                    ? 'Real-time alert resolution across multi-region quorums.'
                    : 'Real-time telemetry and edge mesh status.'}
                </p>
              </div>
            </div>

            {/* Top KPI Strips for Overview and Monitors */}
            {(activeTab === 'overview' || activeTab === 'monitors') && (
              <StatsGrid stats={stats} />
            )}

            {/* Monitors Matrix */}
            {(activeTab === 'overview' || activeTab === 'monitors') && (
              <div className="space-y-4">
                <MonitorList
                  monitors={monitors}
                  executingCheckId={executingCheckId}
                  onOpenDetails={handleOpenDetails}
                  onTriggerCheck={handleTriggerCheck}
                  onDelete={handleDeleteMonitor}
                  onCreateSample={createSampleMonitors}
                  onOpenCreateModal={handleOpenCreateModal}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <Analytics monitors={monitors} />
              </div>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="space-y-4">
                <IncidentList
                  incidents={incidents}
                  monitors={monitors}
                  onAcknowledge={handleAcknowledge}
                />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <SettingsView />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Monitor Detail Drawer */}
      <MonitorDrawer
        monitor={selectedMonitor}
        executingCheckId={executingCheckId}
        onClose={handleCloseDetails}
        onTriggerCheck={handleTriggerCheck}
      />

      {/* Deploy Monitor Modal */}
      {isCreateModalOpen && (
        <CreateMonitorModal
          onClose={handleCloseCreateModal}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
