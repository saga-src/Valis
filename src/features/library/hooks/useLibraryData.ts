import { useEffect, useMemo, useState } from 'react';
import { getLibrary, getAllSessions } from '../../../lib/storage';
import { STORE_NAMES, resolvePlatformHardwareAndStores } from '../utils/libraryUtils';
import { getUniqueGenres, getUniqueThemes, getUniquePerspectives, getUniqueGameModes } from '../../../lib/utils/filters';
import { useLibraryStore } from '../../../store/libraryStore';
import { useCachedResource } from '../../../lib/cache/useCachedResource';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies, noCachePolicy } from '../../../lib/cache/cachePolicy';

export const useLibraryData = () => {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [enableCache, setEnableCache] = useState(true);
  const { setLibrary } = useLibraryStore();

  useEffect(() => {
    const loadSetting = async () => {
      try {
        if (window.api?.getSetting) {
          const value = await window.api.getSetting('enable_library_cache');
          setEnableCache(value !== false);
        }
      } catch (error) {
        console.error('[Library] Failed to load cache setting:', error);
      } finally {
        setSettingsLoaded(true);
      }
    };
    void loadSetting();
  }, []);

  const libraryResource = useCachedResource<any[]>({
    key: cacheKeys.library,
    fetcher: getLibrary,
    policy: enableCache ? cachePolicies.library : noCachePolicy,
    enabled: settingsLoaded,
    initialData: [],
  });

  const sessionsResource = useCachedResource<any[]>({
    key: cacheKeys.sessionsAll,
    fetcher: getAllSessions,
    policy: cachePolicies.sessions,
    enabled: settingsLoaded,
    initialData: [],
  });

  const games = libraryResource.data || [];
  const sessions = sessionsResource.data || [];
  const loading = !settingsLoaded || libraryResource.loading || sessionsResource.loading;

  useEffect(() => {
    if (games.length > 0) setLibrary(games);
  }, [games, setLibrary]);

  useEffect(() => {
    if (games.length > 0 && window.api?.cacheLibraryImages) {
      window.api.cacheLibraryImages(games);
    }
  }, [games]);

  const { platforms, stores } = useMemo(() =>
    resolvePlatformHardwareAndStores(games, STORE_NAMES),
  [games]);

  const genres = useMemo(() => getUniqueGenres(games), [games]);
  const themes = useMemo(() => getUniqueThemes(games), [games]);
  const perspectives = useMemo(() => getUniquePerspectives(games), [games]);
  const gameModes = useMemo(() => getUniqueGameModes(games), [games]);

  const lastPlayedMap = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(s => {
      const time = new Date(s.start_time).getTime();
      if (!map[s.game_id] || time > map[s.game_id]) {
        map[s.game_id] = time;
      }
    });
    return map;
  }, [sessions]);

  return {
    games,
    sessions,
    platforms,
    stores,
    genres,
    themes,
    perspectives,
    gameModes,
    lastPlayedMap,
    loading,
    refresh: () => Promise.all([libraryResource.refresh(), sessionsResource.refresh()]),
  };
};
