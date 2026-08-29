import React, { useState } from 'react';
import { Server, AlertTriangle } from 'lucide-react';
import { useDashboardData } from './hooks/useDashboardData';
import { Navbar } from './components/Navbar';
import { StatsGrid } from './components/StatsGrid';
import { MonitorList } from './components/MonitorList';
import { IncidentList } from './components/IncidentList';
import { MonitorDrawer } from './components/MonitorDrawer';
import { CreateMonitorModal } from './components/CreateMonitorModal';
import { Monitor } from './types';

export default function App() {
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
  } = useDashboardData();

  const [activeTab, setActiveTab] = useState<'monitors' | 'incidents'>('monitors');
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
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-gray-100">
      <Navbar
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        showCreateSampleBtn={monitors.length === 0}
        onCreateSample={createSampleMonitors}
        onOpenCreateModal={() => setShowCreateModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <StatsGrid stats={stats} />

        <div className="border-b border-gray-800 flex space-x-8">
          <button
            onClick={() => setActiveTab('monitors')}
            className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'monitors'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Monitors Fleet ({monitors.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'incidents'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Incidents Log ({incidents.length})</span>
          </button>
        </div>

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
      </main>

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
