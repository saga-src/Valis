
import { useState, useEffect, useMemo } from 'react';
import { getLibrary, getAllSessions } from '../../../lib/storage';
import { System } from '../../../lib/api';

export const useCoreAnalytics = () => {
  const [library, setLibrary] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [analyticsItems, setAnalyticsItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.api) return;

    Promise.all([
        window.api.getLibrary(), 
        window.api.getAllSessions(),
        window.api.getAnalyticsData()
    ])
      .then(([games, sess, agg]) => {
        setLibrary(games || []);
        setSessions(sess || []);
        setAnalyticsItems(agg || []);
        setLoading(false);
      })
      .catch(err => {
        System.error("Failed to fetch core analytics data", err);
        setLoading(false);
      });
  }, []);

  // Pre-calculate game playtime map (GameID -> Minutes)
  const gamePlaytimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    
    analyticsItems.forEach(item => {
        if (item.id) {
            const sessionMin = (item.session_seconds || item.playtime_seconds || 0) / 60;
            const legacyMin = (item.legacy_playtime_seconds || 0) / 60;
            map[item.id] = sessionMin + legacyMin;
        }
    });

    return map;
  }, [analyticsItems]);

  return { library, sessions, gamePlaytimeMap, loading };
};
