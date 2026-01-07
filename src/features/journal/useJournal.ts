import { useState, useEffect, useCallback } from 'react';
import { getAllSessions, getLibrary } from '../../lib/storage';

export interface Session {
  id: string;
  game_id: string;
  platform_id?: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  duration_seconds?: number;
  mood: string;
  notes: string | string[];
  journal?: string;
}

export const useJournal = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessData, libData] = await Promise.all([
        getAllSessions(),
        getLibrary()
      ]);
      
      // Create lookup map for easy access to titles/covers
      const gameMap: Record<string, any> = {};
      libData.forEach((g: any) => {
        gameMap[g.id] = g;
      });

      // Sort sessions new to old
      const sorted = [...sessData].sort((a: any, b: any) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      setSessions(sorted);
      setGames(gameMap);
    } catch (e) {
      console.error("Journal fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { sessions, games, loading, refresh: fetchData };
};