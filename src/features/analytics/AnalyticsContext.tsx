import React, { createContext, useContext, useMemo, useState } from 'react';
import { cacheKeys } from '../../lib/cache/cacheKeys';
import { cachePolicies } from '../../lib/cache/cachePolicy';
import { useCachedResource } from '../../lib/cache/useCachedResource';
import { System } from '../../lib/api';

interface AnalyticsFilterState {
  timeRange: 'all' | 'year' | 'month';
  genre: string | null;
  status: string | null;
  excludeFree: boolean;
  officialOnly: boolean;
}

interface AnalyticsCoreData {
  library: any[];
  sessions: any[];
  analyticsItems: any[];
}

interface AnalyticsContextType {
  filters: AnalyticsFilterState;
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilterState>>;
  library: any[];
  sessions: any[];
  analyticsItems: any[];
  gamePlaytimeMap: Record<string, number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<AnalyticsCoreData | undefined>;
}

export const AnalyticsFilterContext = createContext<AnalyticsContextType | undefined>(undefined);

const parseArray = (value: any) => {
  try {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return JSON.parse(value || '[]');
  } catch {}
  return [];
};

const hasGenre = (game: any, genre: string | null) => {
  if (!genre) return true;
  return parseArray(game.genres).some((item: any) => (item.name || item) === genre);
};

const isOfficial = (game: any) => {
  const owned = parseArray(game.owned_platform_ids);
  return !owned.some((id: any) => Number(id) === 99999 || Number(id) === 100000);
};

const isWithinTimeRange = (timestamp: any, range: AnalyticsFilterState['timeRange']) => {
  if (range === 'all') return true;
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return false;
  const now = Date.now();
  const windowMs = range === 'month' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
  return time >= now - windowMs;
};

export const useAnalyticsFilters = () => {
  const context = useContext(AnalyticsFilterContext);
  if (!context) {
    throw new Error('useAnalyticsFilters must be used within an AnalyticsProvider');
  }
  return context;
};

export const useAnalyticsCore = () => useAnalyticsFilters();

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    timeRange: 'all',
    genre: null,
    status: null,
    excludeFree: false,
    officialOnly: false,
  });

  const {
    data,
    loading,
    error,
    refresh,
  } = useCachedResource<AnalyticsCoreData>({
    key: cacheKeys.analyticsCore,
    policy: cachePolicies.analytics,
    initialData: { library: [], sessions: [], analyticsItems: [] },
    fetcher: async () => {
      if (!window.api) return { library: [], sessions: [], analyticsItems: [] };
      try {
        const [library, sessions, analyticsItems] = await Promise.all([
          window.api.getLibrary(),
          window.api.getAllSessions(),
          window.api.getAnalyticsData(),
        ]);
        return {
          library: library || [],
          sessions: sessions || [],
          analyticsItems: analyticsItems || [],
        };
      } catch (err) {
        System.error('Failed to fetch core analytics data', err);
        throw err;
      }
    },
  });

  const filtered = useMemo(() => {
    const source = data || { library: [], sessions: [], analyticsItems: [] };

    const library = source.library.filter((game) => {
      if (filters.excludeFree && Number(game.acquired_price || 0) <= 0) return false;
      if (filters.officialOnly && !isOfficial(game)) return false;
      if (filters.status && (game.status || 'Backlog') !== filters.status) return false;
      if (!hasGenre(game, filters.genre)) return false;
      return true;
    });

    const visibleIds = new Set(library.map((game) => String(game.id)));
    const sessions = source.sessions.filter((session) => (
      visibleIds.has(String(session.game_id)) && isWithinTimeRange(session.start_time, filters.timeRange)
    ));

    const analyticsItems = source.analyticsItems.filter((item) => visibleIds.has(String(item.id || item.game_id)));
    const gamePlaytimeMap: Record<string, number> = {};

    sessions.forEach((session) => {
      if (!session.game_id) return;
      const seconds = Number(session.duration_seconds || 0) || Number(session.duration_minutes || 0) * 60;
      gamePlaytimeMap[session.game_id] = (gamePlaytimeMap[session.game_id] || 0) + seconds / 60;
    });

    return { library, sessions, analyticsItems, gamePlaytimeMap };
  }, [data, filters]);

  return (
    <AnalyticsFilterContext.Provider
      value={{
        filters,
        setFilters,
        library: filtered.library,
        sessions: filtered.sessions,
        analyticsItems: filtered.analyticsItems,
        gamePlaytimeMap: filtered.gamePlaytimeMap,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </AnalyticsFilterContext.Provider>
  );
};
