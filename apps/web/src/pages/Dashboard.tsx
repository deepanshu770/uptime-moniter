import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { StatsGrid } from '../components/StatsGrid';
import { MonitorList } from '../components/MonitorList';
import { IncidentList } from '../components/IncidentList';
import { MonitorDrawer } from '../components/MonitorDrawer';
import { CreateMonitorModal } from '../components/CreateMonitorModal';
import { Monitor } from '../types';

export default function Dashboard() {
  const { accessToken, logout } = useAuth();
  const {
    stats,
    monitors,
    incidents,
    autoRefresh,
    setAutoRefresh,
    fetchData,
    triggerManualCheck,
    deleteMonitor,
    acknowledgeIncident,
    createSampleMonitors,
  } = useDashboardData(accessToken, logout);

  const [activeTab, setActiveTab] = useState<'monitors' | 'incidents' | string>('monitors');
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executingCheckId, setExecutingCheckId] = useState<string | null>(null);

  const handleTriggerCheck = (monitorId: string) => {
    triggerManualCheck(monitorId, setExecutingCheckId, () => {
      // Intentionally left blank. The MonitorDrawer independently fetches its results.
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
    <div className="h-screen flex overflow-hidden bg-light-bg text-light-textMain">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          showCreateSampleBtn={monitors.length === 0}
          onCreateSample={createSampleMonitors}
          onOpenCreateModal={() => setShowCreateModal(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-light-textMain mb-1">
                {activeTab === 'overview' ? 'Overview' : activeTab === 'monitors' ? 'Monitors' : activeTab === 'incidents' ? 'Incidents' : 'Dashboard'}
              </h1>
              <p className="text-sm text-light-textMuted">
                {activeTab === 'monitors' ? 'Monitor your services, APIs, websites and infrastructure endpoints.' : 'Monitor your services and endpoints.'}
              </p>
            </header>

            <StatsGrid stats={stats} />

            {activeTab === 'monitors' && (
              <div className="space-y-4">
                <MonitorList
                  monitors={monitors}
                  executingCheckId={executingCheckId}
                  onOpenDetails={setSelectedMonitor}
                  onTriggerCheck={handleTriggerCheck}
                  onDelete={handleDeleteMonitor}
                  onCreateSample={createSampleMonitors}
                  onOpenCreateModal={() => setShowCreateModal(true)}
                />
              </div>
            )}

            {activeTab === 'incidents' && (
              <div className="space-y-4">
                <IncidentList
                  incidents={incidents}
                  monitors={monitors}
                  onAcknowledge={acknowledgeIncident}
                />
              </div>
            )}
            
            {activeTab !== 'monitors' && activeTab !== 'incidents' && (
              <div className="p-8 text-center text-light-textMuted border border-dashed border-light-border rounded-xl">
                This section is under construction.
              </div>
            )}
          </div>
        </main>
      </div>

      <MonitorDrawer
        monitor={selectedMonitor}
        executingCheckId={executingCheckId}
        onClose={() => setSelectedMonitor(null)}
        onTriggerCheck={handleTriggerCheck}
      />

      {showCreateModal && (
        <CreateMonitorModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
