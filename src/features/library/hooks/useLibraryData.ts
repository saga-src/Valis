import { useState, useEffect, useMemo } from 'react';
import { getLibrary, getAllSessions } from '../../../lib/storage';
import { STORE_NAMES, resolvePlatformHardwareAndStores } from '../utils/libraryUtils';
import { getUniqueGenres, getUniqueThemes, getUniquePerspectives, getUniqueGameModes } from '../../../lib/utils/filters';
import { useLibraryStore } from '../../../store/libraryStore';

export const useLibraryData = () => {
  const [games, setGames] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initialization State for Caching
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [enableCache, setEnableCache] = useState(false);
  const { isCached, games: cachedGames, setLibrary } = useLibraryStore();

  // 2. Load Caching Setting First to avoid race conditions
  useEffect(() => {
    const loadSetting = async () => {
      try {
        if (window.api && window.api.getSetting) {
          const value = await window.api.getSetting('enable_library_cache');
          console.log('[Library] Cache Setting Value Loaded:', value);
          setEnableCache(!!value);
        }
      } catch (e) {
        console.error('[Library] Failed to load cache setting:', e);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadSetting();
  }, []);

  // 3. Main Data Fetching Logic with Guard
  useEffect(() => {
    const fetchData = async () => {
      // Guard: Do not attempt to fetch data until we know the caching preference
      if (!settingsLoaded) return;

      console.log('[Library] Fetching data with config -> enableCache:', enableCache, '| isCached:', isCached);

      // 4. MOUNT LOGIC: If Cache Enabled and valid, use it for instant render
      if (enableCache && isCached && cachedGames.length > 0) {
        console.log('🚀 [Library] Using Cached Data');
        setGames(cachedGames);
        
        // Background fetch sessions (small data, frequent updates)
        getAllSessions().then(setSessions).catch(() => {});
        
        setLoading(false);
        return;
      }

      // 5. CACHE DISABLED OR STALE: Fetch from local database
      console.log('🌍 [Library] Cache Disabled/Empty -> Fetching from API...');
      setLoading(true);
      try {
        const [g, s] = await Promise.all([getLibrary(), getAllSessions()]);
        setGames(g);
        setSessions(s);

        // 6. Update store for future use if caching is enabled
        if (enableCache) {
          console.log('✅ [Library] API Fetch Complete. Saving to Store.');
          setLibrary(g);
        }
      } catch (error) {
        console.error('[Library] Failed to load library:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [settingsLoaded, enableCache, isCached, setLibrary]);

  // Trigger background caching for images when games are loaded
  useEffect(() => {
    if (games.length > 0 && window.api?.cacheLibraryImages) {
        window.api.cacheLibraryImages(games);
    }
  }, [games]);

  // Compute unique hardware platforms and digital stores via utility
  const { platforms, stores } = useMemo(() => 
    resolvePlatformHardwareAndStores(games, STORE_NAMES), 
  [games]);

  // Compute unique metadata for filters
  const genres = useMemo(() => getUniqueGenres(games), [games]);
  const themes = useMemo(() => getUniqueThemes(games), [games]);
  const perspectives = useMemo(() => getUniquePerspectives(games), [games]);
  const gameModes = useMemo(() => getUniqueGameModes(games), [games]);

  // Last Played Mapping
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
    loading 
  };
};
