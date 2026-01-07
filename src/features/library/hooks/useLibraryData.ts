import { useState, useEffect, useMemo } from 'react';
import { getLibrary, getAllSessions } from '../../../lib/storage';
import { STORE_NAMES, resolvePlatformHardwareAndStores } from '../utils/libraryUtils';
import { getUniqueGenres, getUniqueThemes, getUniquePerspectives, getUniqueGameModes } from '../../../lib/utils/filters';

export const useLibraryData = () => {
  const [games, setGames] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [g, s] = await Promise.all([getLibrary(), getAllSessions()]);
        setGames(g);
        setSessions(s);
      } catch (error) {
        console.error('Failed to load library:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
