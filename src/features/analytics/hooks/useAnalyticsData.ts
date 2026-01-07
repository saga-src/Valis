
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getLibrary, getAllSessions } from '../../../lib/storage';
import { format } from 'date-fns';

function subDays(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
}

const parse = (json: any) => {
  try { return typeof json === 'string' ? JSON.parse(json) : json || []; } catch { return []; }
};

export const useAnalyticsData = () => {
  const [library, setLibrary] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getLibrary(), getAllSessions()]).then(([games, sess]) => {
      setLibrary(games);
      setSessions(sess);
      setLoading(false);
    });
  }, []);

  // Pre-calculate game playtime map (GameID -> Minutes)
  const gamePlaytimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(s => {
      if (s.game_id) {
        // Handle both duration_minutes (legacy) and duration_seconds (new)
        let minutes = 0;
        if (typeof s.duration_seconds === 'number') {
            minutes = s.duration_seconds / 60;
        } else if (typeof s.duration_minutes === 'number') {
            minutes = s.duration_minutes;
        }
        
        map[s.game_id] = (map[s.game_id] || 0) + minutes;
      }
    });
    return map;
  }, [sessions]);

  // 1. Radar Data Generator (Generic)
  const getRadarData = useCallback((
    field: 'genres' | 'themes' | 'player_perspectives' | 'game_modes', 
    useHours: boolean = false
  ) => {
    const counts: Record<string, number> = {};
    
    library.forEach(game => {
      const items = parse(game[field]);
      // If useHours is true, weight by minutes played. Else weight by count (1).
      // gamePlaytimeMap stores minutes.
      const weight = useHours ? (gamePlaytimeMap[game.id] || 0) : 1;

      // If useHours is on but the game hasn't been played, it contributes 0.
      if (useHours && weight === 0) return;

      items.forEach((item: any) => {
        if (item.name) {
          counts[item.name] = (counts[item.name] || 0) + weight;
        }
      });
    });

    // Transform to Recharts format and take top 6 to avoid clutter
    const maxVal = Math.max(...Object.values(counts), 0);
    return Object.entries(counts)
      .map(([subject, value]) => ({ 
        subject, 
        value: Math.round(value), 
        fullMark: Math.ceil(maxVal * 1.1) // 10% buffer
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [library, gamePlaytimeMap]);

  // 2. Heatmap Data (Last 365 Days)
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = subDays(new Date(), 365);

    sessions.forEach(s => {
      const d = new Date(s.start_time);
      if (d >= cutoff) {
        const dateStr = format(d, 'yyyy-MM-dd');
        
        let minutes = 0;
        if (typeof s.duration_seconds === 'number') {
            minutes = s.duration_seconds / 60;
        } else if (typeof s.duration_minutes === 'number') {
            minutes = s.duration_minutes;
        }

        map[dateStr] = (map[dateStr] || 0) + minutes;
      }
    });

    return Object.entries(map).map(([date, minutes]) => ({
      date,
      count: Math.round(minutes / 60 * 10) / 10 // Hours with 1 decimal
    }));
  }, [sessions]);

  // 3. Scatter Plot (Hours vs Score)
  const scatterData = useMemo(() => {
    return library
      .filter(g => typeof g.final_score === 'number' && g.final_score > 0)
      .map(g => {
        const minutes = gamePlaytimeMap[g.id] || 0;
        return {
          id: g.id,
          name: g.title,
          x: Math.round(minutes / 60 * 10) / 10, // Playtime (Hours)
          y: g.final_score, // Score (0-10)
          z: 1 // Bubble size (could be cost, but kept simple for now)
        };
      })
      .filter(d => d.x > 0); // Only chart played games
  }, [library, gamePlaytimeMap]);

  // 4. Era Distribution (Release Year)
  const eraData = useMemo(() => {
    const counts: Record<string, number> = {};
    let minYear = 3000;
    let maxYear = 1900;

    library.forEach(g => {
      if (g.first_release_date) {
        const year = new Date(g.first_release_date * 1000).getFullYear();
        if (year > 1970 && year <= new Date().getFullYear() + 2) { // Sanity check
            counts[year] = (counts[year] || 0) + 1;
            if (year < minYear) minYear = year;
            if (year > maxYear) maxYear = year;
        }
      }
    });

    // Fill gaps with 0
    const data = [];
    if (minYear < 3000) {
        for (let y = minYear; y <= maxYear; y++) {
            data.push({ year: y, count: counts[y] || 0 });
        }
    }
    return data;
  }, [library]);

  // 5. Status Distribution (Backlog, etc.)
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      'Backlog': 0, 'Playing': 0, 'Completed': 0, 'Dropped': 0, 'Shelved': 0
    };
    library.forEach(g => {
      const s = g.status || 'Backlog';
      if (counts[s] !== undefined) counts[s]++;
    });
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .filter(d => d.value > 0);
  }, [library]);

  return {
    library,
    sessions,
    loading,
    getRadarData,
    heatmapData,
    scatterData,
    eraData,
    statusData
  };
};
