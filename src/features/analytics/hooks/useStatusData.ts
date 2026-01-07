
import { useMemo } from 'react';
import { getTotalPlaytimeSeconds } from '../../../lib/utils/format';
import { useAnalyticsFilters } from '../AnalyticsContext';

export const useStatusData = (library: any[], sessions: any[] = []) => {
  const { filters } = useAnalyticsFilters();

  return useMemo(() => {
    // --- 0. PRE-FILTER DATA ---
    const filteredLibrary = library.filter(g => {
        // Exclude Free
        if (filters.excludeFree) {
             const price = typeof g.acquired_price === 'number' ? g.acquired_price : 0;
             if (price <= 0) return false;
        }

        // Official Only
        if (filters.officialOnly) {
            try {
                // Parse platform ownership to check for Unofficial ID (99999)
                const ownership = typeof g.owned_platform_ids === 'string' 
                    ? JSON.parse(g.owned_platform_ids || '[]') 
                    : g.owned_platform_ids || [];
                
                // If any of the owned platforms is unofficial, we *could* filter it out,
                // but usually "official only" means we only want games from real stores.
                // If a game is added as "Unofficial Copy" (99999), we exclude it.
                if (ownership.some((id: any) => Number(id) === 99999)) return false;
            } catch {
                // If parsing fails, be safe and include it? or exclude? 
                // Let's assume include to be safe unless we know it's bad.
            }
        }

        return true;
    });

    const filteredGameIds = new Set(filteredLibrary.map(g => g.id));
    
    // Filter sessions to only those matching the filtered games
    const filteredSessions = sessions.filter(s => filteredGameIds.has(s.game_id));

    // --- 1. Initialize Chart Data Counters ---
    const counts: Record<string, number> = {
      'Backlog': 0, 'Playing': 0, 'Beat': 0, 'Completed': 0, 'Dropped': 0, 'Shelved': 0
    };

    // --- 2. Initialize Metric Accumulators ---
    let totalLibraryValue = 0;
    let totalPlaytimeSeconds = 0;
    let gamesPlayedCount = 0;
    let beatCount = 0;      // Status 'Beat'
    let completedCount = 0; // Status 'Completed' (100%)

    // For "On Beaten" metrics
    let beatenSubsetCount = 0;
    let beatenTrophySum = 0;
    let beatenPerfectCount = 0;

    // --- Process Library (Filtered) ---
    filteredLibrary.forEach(g => {
      // Status Counts
      const s = g.status || 'Backlog';
      if (counts[s] !== undefined) counts[s]++;
      else counts[s] = 1;

      // Financials
      const price = typeof g.acquired_price === 'number' ? g.acquired_price : 0;
      totalLibraryValue += price;

      // Playtime
      const seconds = getTotalPlaytimeSeconds(g);
      totalPlaytimeSeconds += seconds;

      if (seconds > 0) gamesPlayedCount++;

      if (g.status === 'Beat') beatCount++;
      if (g.status === 'Completed') completedCount++;

      // Beaten Subset (Beat OR Completed)
      if (g.status === 'Beat' || g.status === 'Completed') {
          beatenSubsetCount++;
          
          // Use achievement_progress if available, otherwise assume 100 if Completed, else 0
          const progress = typeof g.achievement_progress === 'number' ? g.achievement_progress : (g.status === 'Completed' ? 100 : 0);
          
          beatenTrophySum += progress;
          
          if (progress === 100 || g.status === 'Completed') {
              beatenPerfectCount++;
          }
      }
    });

    // Format Chart Data for Recharts
    const chartData = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .filter(d => d.value > 0);

    // --- Process Sessions (Filtered) ---
    const uniqueDays = new Set<string>();
    filteredSessions.forEach(s => {
        if (s.start_time) {
            const date = new Date(s.start_time).toDateString();
            uniqueDays.add(date);
        }
    });
    const uniqueDaysPlayed = uniqueDays.size;

    // --- Calculate Derived Metrics ---
    const totalGames = filteredLibrary.length || 1; // Prevent division by zero
    const totalPlaytimeHours = totalPlaytimeSeconds / 3600;

    // "Beat Rate" generally includes both Beat (Story) and Completed (100%)
    const beatRate = ((beatCount + completedCount) / totalGames) * 100;
    
    // "Completion Rate" is specifically 100% / Platinum
    const completionRate = (completedCount / totalGames) * 100;

    // Beaten Specific Metrics
    const avgTrophyOnBeaten = beatenSubsetCount > 0 ? beatenTrophySum / beatenSubsetCount : 0;
    const perfectOnBeaten = beatenSubsetCount > 0 ? (beatenPerfectCount / beatenSubsetCount) * 100 : 0;

    // Cost Efficiency
    const costPerHour = totalPlaytimeHours > 0 ? totalLibraryValue / totalPlaytimeHours : 0;
    const avgCostPerGame = totalLibraryValue / totalGames;

    // Engagement Averages
    const avgPlaytimePerGame = gamesPlayedCount > 0 ? totalPlaytimeSeconds / gamesPlayedCount : 0;
    const avgPlaytimePerDay = uniqueDaysPlayed > 0 ? totalPlaytimeSeconds / uniqueDaysPlayed : 0;

    return {
      chartData,
      metrics: {
        totalPlaytime: totalPlaytimeSeconds,
        totalSessions: filteredSessions.length,
        totalGames,
        libraryValue: totalLibraryValue,
        costPerHour,
        avgCostPerGame,
        gamesPlayedCount,
        uniqueDaysPlayed,
        beatRate,
        completionRate,
        avgTrophyOnBeaten,
        perfectOnBeaten,
        avgPlaytimePerGame,
        avgPlaytimePerDay
      }
    };
  }, [library, sessions, filters.excludeFree, filters.officialOnly]);
};
