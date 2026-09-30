import { useState, useEffect } from 'react';

export function useAnalyticsData(accessToken: string | null, hours: number, monitorId?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = () => setRefreshTick(t => t + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const url = monitorId ? `/v1/analytics?hours=${hours}&monitorId=${monitorId}` : `/v1/analytics?hours=${hours}`;
        const res = await fetch(url, {
          headers: {
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (active) {
            setData(json);
          }
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (accessToken) {
      fetchData();
    }

    return () => { active = false; };
  }, [accessToken, hours, monitorId, refreshTick]);

  return { data, loading, refresh };
}
