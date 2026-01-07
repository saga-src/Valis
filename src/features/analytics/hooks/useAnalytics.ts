import { useState, useEffect, useMemo } from 'react';
import { System } from '../../../lib/api';
import { getTotalPlaytimeSeconds } from '../../lib/utils/format';

export const useAnalytics = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [excludeFree, setExcludeFree] = useState(false);
  const [excludeUnofficial, setExcludeUnofficial] = useState(false);

  useEffect(() => {
    if (window.api && window.api.getAnalyticsData) {
        window.api.getAnalyticsData()
          .then((res: any[]) => {
            setData(res || []);
            setLoading(false);
          })
          .catch((err: any) => {
            System.error("Failed to load analytics data", err);
            setLoading(false);
          });
    }
  }, []);

  const metrics = useMemo(() => {
    let totalSpent = 0;
    let totalGames = 0;
    let backlogSize = 0;
    let totalPlaytimeSeconds = 0;

    data.forEach(game => {
      if (!game) return;

      // 1. Determine which session pool to use based on the filter
      const activeSessionTime = excludeUnofficial 
        ? (game.official_session_seconds || 0) 
        : (game.total_session_seconds || 0);

      // 2. Total = (Filtered Sessions) + Legacy Time
      // ⚡ Using the logic from getTotalPlaytimeSeconds but applying session filters
      const totalSeconds = activeSessionTime + (game.legacy_playtime_seconds || 0);
      
      const price = typeof game.price === 'number' ? game.price : parseFloat(game.price || '0');
      const isFree = price <= 0;

      // --- FILTER LOGIC ---
      // Respect the "No Free" filter
      if (excludeFree && isFree) return;
      
      // We only include games in analytics metrics if they have some playtime after filtering
      if (totalSeconds <= 0) return;

      // --- CALCULATIONS ---
      totalGames++;
      totalSpent += isNaN(price) ? 0 : price;
      totalPlaytimeSeconds += totalSeconds;

      const status = (game.status || 'Backlog').toLowerCase();
      if (status === 'backlog') {
        backlogSize++;
      }
    });

    const totalHours = totalPlaytimeSeconds / 3600;
    const costPerHour = totalHours > 0 ? totalSpent / totalHours : 0;

    return {
      totalSpent,
      totalGames,
      totalHours,
      costPerHour,
      backlogSize
    };
  }, [data, excludeFree, excludeUnofficial]);

  return {
    metrics,
    loading,
    excludeFree,
    setExcludeFree,
    excludeUnofficial,
    setExcludeUnofficial
  };
};
