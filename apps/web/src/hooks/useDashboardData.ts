import { useState, useEffect, useCallback } from 'react';
import { SystemStats, Monitor } from '../types';

export function useDashboardData(accessToken: string | null, logout?: () => void) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
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
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, logout]);

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
      await fetch(`/v1/monitors/${monitorId}/check`, { method: 'POST', headers: getHeaders(), body: '{}' });
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
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      await fetch(`/v1/monitors/${monitorId}`, { method: 'DELETE', headers });
      onDeleted();
      fetchData();
    } catch (e) {
      console.error(e);
    }
  }, [accessToken, fetchData]);

  const createSampleMonitors = useCallback(async () => {
    const samples = [
      { name: 'Google Cloud Gateway', target: 'https://www.google.com', interval: 10 },
      { name: 'GitHub Status Endpoint', target: 'https://www.githubstatus.com', interval: 30 },
      { name: 'Simulated Flaky Service', target: 'https://httpbin.org/status/500', interval: 10 },
    ];

    for (const s of samples) {
      await fetch('/v1/monitors', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: s.name,
          target: s.target,
          interval_seconds: s.interval,
          timeout_ms: 10000,
          regions: ['us-east'],
        }),
      });
    }
    fetchData();
  }, [fetchData, getHeaders]);

  return {
    stats,
    monitors,
    loading,
    autoRefresh,
    setAutoRefresh,
    fetchData,
    triggerManualCheck,
    deleteMonitor,
    createSampleMonitors,
  };
}
