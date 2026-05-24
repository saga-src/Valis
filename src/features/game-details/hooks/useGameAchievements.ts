import { useCallback, useEffect } from 'react';
import { Achievement } from '../../../types/achievements';
import { useCachedResource } from '../../../lib/cache/useCachedResource';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies } from '../../../lib/cache/cachePolicy';
import { invalidateAchievementCaches } from '../../../lib/cache/invalidation';

export const useGameAchievements = (gameId: string) => {
  const resource = useCachedResource<Achievement[]>({
    key: gameId ? cacheKeys.achievementsForGame(gameId) : 'achievements:missing',
    fetcher: async () => {
      if (!gameId || !window.api?.getGameAchievements) return [];
      return await window.api.getGameAchievements(gameId);
    },
    policy: cachePolicies.achievements,
    enabled: Boolean(gameId),
    initialData: [],
  });

  const refreshResource = resource.refresh;

  const refresh = useCallback(async () => {
    invalidateAchievementCaches(gameId);
    return (await refreshResource()) || [];
  }, [gameId, refreshResource]);

  useEffect(() => {
    if (!gameId || !window.api?.onAchievementUnlocked) return;
    const unsubscribe = window.api.onAchievementUnlocked((data: any) => {
      if (String(data.gameId) === String(gameId)) {
        void refresh();
      }
    });
    return () => unsubscribe();
  }, [gameId, refresh]);

  return {
    achievements: resource.data || [],
    loading: resource.loading,
    refresh,
  };
};
