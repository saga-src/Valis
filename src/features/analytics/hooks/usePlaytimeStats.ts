import { useCoreAnalytics } from './useCoreAnalytics';
import { getTotalPlaytimeSeconds } from '../../../lib/utils/format';

export const usePlaytimeStats = () => {
  const { library, sessions, loading } = useCoreAnalytics();
  
  // Calculate total playtime by summing up all games in the library
  // This handles both legacy_playtime_seconds (manual/imported) and session_seconds (tracked)
  const totalPlaytime = library.reduce((acc, game) => {
    return acc + getTotalPlaytimeSeconds(game);
  }, 0);
  
  // Calculate Average Session Duration from the sessions table
  const totalSessionTime = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const averageSessionDuration = sessions.length > 0 ? totalSessionTime / sessions.length : 0;

  return { totalPlaytime, averageSessionDuration, isLoading: loading };
};
