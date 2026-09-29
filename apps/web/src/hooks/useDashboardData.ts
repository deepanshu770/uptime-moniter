import { useState, useEffect, useCallback } from 'react';
import { SystemStats, Monitor, Incident } from '../types';

export function useDashboardData(accessToken: string | null, logout?: () => void) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  }, [accessToken]);

  const fetchData = useCallback(async () => {
    try {
      const statsRes = await fetch('/v1/stats', { headers: getHeaders() });
      if (statsRes.status === 401 && logout) {
        logout();
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setMonitors(statsData.monitors || []);
      }

      const incidentsRes = await fetch('/v1/incidents', { headers: getHeaders() });
      if (incidentsRes.status === 401 && logout) {
        logout();
        return;
      }
      if (incidentsRes.ok) {
        const incData = await incidentsRes.json();
        setIncidents(incData);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData();
    let timer: any;
    if (autoRefresh) {
      timer = setInterval(fetchData, 5000);
    }
    return () => clearInterval(timer);
  }, [autoRefresh, fetchData]);

  const triggerManualCheck = useCallback(async (monitorId: string, setExecutingCheckId: (id: string | null) => void, onRefreshMonitor: () => void) => {
    setExecutingCheckId(monitorId);
    try {
      await fetch(`/v1/monitors/${monitorId}/check`, { method: 'POST', headers: getHeaders() });
      await fetchData();
      onRefreshMonitor();
    } catch (e) {
      console.error(e);
    } finally {
      setExecutingCheckId(null);
    }
  }, [fetchData, getHeaders]);

  const deleteMonitor = useCallback(async (monitorId: string, onDeleted: () => void) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    try {
      await fetch(`/v1/monitors/${monitorId}`, { method: 'DELETE', headers: getHeaders() });
      onDeleted();
      fetchData();
    } catch (e) {
      console.error(e);
    }
  }, [fetchData, getHeaders]);

  const acknowledgeIncident = useCallback(async (incidentId: string) => {
    try {
      await fetch(`/v1/incidents/${incidentId}/acknowledge`, { method: 'POST', headers: getHeaders() });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  }, [fetchData, getHeaders]);

  const createSampleMonitors = useCallback(async () => {
    const samples = [
      { name: 'Google Cloud Gateway', type: 'http', target: 'https://www.google.com', interval: 10 },
      { name: 'Cloudflare DNS Service', type: 'dns', target: 'one.one.one.one', interval: 15 },
      { name: 'GitHub Status Endpoint', type: 'http', target: 'https://www.githubstatus.com', interval: 30 },
      { name: 'Simulated Flaky Service', type: 'http', target: 'https://httpbin.org/status/500', interval: 10 },
    ];

    for (const s of samples) {
      await fetch('/v1/monitors', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: s.name,
          type: s.type,
          target: s.target,
          interval_seconds: s.interval,
          timeout_ms: 10000,
          regions: ['us-east', 'eu-west'],
          config: { method: 'GET' },
        }),
      });
    }
    fetchData();
  }, [fetchData, getHeaders]);

  return {
    stats,
    monitors,
    incidents,
    loading,
    autoRefresh,
    setAutoRefresh,
    fetchData,
    triggerManualCheck,
    deleteMonitor,
    acknowledgeIncident,
    createSampleMonitors,
  };
}
