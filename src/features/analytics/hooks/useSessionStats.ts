import { useCoreAnalytics } from './useCoreAnalytics';

export const useSessionStats = () => {
  const { sessions, loading } = useCoreAnalytics();
  return { totalSessions: sessions.length, isLoading: loading };
};