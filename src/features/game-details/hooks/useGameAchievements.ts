import { useState, useEffect, useCallback } from 'react';
import { Achievement } from '../../../types/achievements';

export const useGameAchievements = (gameId: string) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    try {
      if (window.api && window.api.getGameAchievements) {
        const data = await window.api.getGameAchievements(gameId);
        setAchievements(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch achievements', error);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchAchievements();

    if (window.api && window.api.onAchievementUnlocked) {
      // Subscribe to real-time unlocks
      const unsubscribe = window.api.onAchievementUnlocked((data: any) => {
          // Check if the event matches the currently viewed game
          if (String(data.gameId) === String(gameId)) {
              // Re-fetch data from DB to update icons (Gray -> Colored) and unlocked status
              fetchAchievements();
          }
      });
      return () => unsubscribe();
    }
  }, [gameId, fetchAchievements]);

  return { achievements, loading, refresh: fetchAchievements };
};