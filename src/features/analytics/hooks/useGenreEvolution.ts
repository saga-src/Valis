
import { useMemo } from 'react';

const safeParse = (json: any) => {
  try { return typeof json === 'string' ? JSON.parse(json) : json || []; } catch { return []; }
};

export const useGenreEvolution = (library: any[], sessions: any[]) => {
  return useMemo(() => {
    // 1. Map Game ID to Genres
    const gameGenreMap: Record<string, string[]> = {};
    const genreTotals: Record<string, number> = {};

    library.forEach(game => {
      const genres = safeParse(game.genres).map((g: any) => g.name || g);
      if (genres.length > 0) {
        gameGenreMap[game.id] = genres;
      }
    });

    // 2. Aggregate Playtime by Year and Genre
    const yearlyData: Record<number, Record<string, number>> = {};

    sessions.forEach(session => {
      if (!session.start_time || !session.game_id) return;
      
      const year = new Date(session.start_time).getFullYear();
      const genres = gameGenreMap[session.game_id] || ['Uncategorized'];
      
      let duration = 0;
      if (typeof session.duration_seconds === 'number') duration = session.duration_seconds;
      else if (typeof session.duration_minutes === 'number') duration = session.duration_minutes * 60;
      
      const hours = duration / 3600;
      if (hours <= 0) return;

      if (!yearlyData[year]) yearlyData[year] = {};

      // Distribute playtime evenly among genres if multiple exist
      // (e.g. Action-RPG gets 50% Action, 50% RPG credit)
      const splitHours = hours / genres.length;

      genres.forEach(genre => {
        yearlyData[year][genre] = (yearlyData[year][genre] || 0) + splitHours;
        genreTotals[genre] = (genreTotals[genre] || 0) + splitHours;
      });
    });

    // 3. Identify Top Genres (limit to 6 to avoid messy chart)
    const topGenres = Object.entries(genreTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(e => e[0]);

    // 4. Format for Recharts
    // Structure: [{ year: 2023, RPG: 120, Action: 40, ... }]
    const sortedYears = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
    
    const streamData = sortedYears.map(year => {
      const entry: any = { year };
      topGenres.forEach(genre => {
        entry[genre] = Math.round((yearlyData[year][genre] || 0) * 10) / 10;
      });
      return entry;
    });

    return { 
      streamData, 
      keys: topGenres 
    };
  }, [library, sessions]);
};
