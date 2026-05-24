import { useAnalyticsCore } from '../AnalyticsContext';

export const useCoreAnalytics = () => {
  const {
    library,
    sessions,
    analyticsItems,
    gamePlaytimeMap,
    loading,
    error,
    refresh,
  } = useAnalyticsCore();

  return { library, sessions, analyticsItems, gamePlaytimeMap, loading, error, refresh };
};
