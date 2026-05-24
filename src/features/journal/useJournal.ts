import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLibrary, getRecentSessions, getSessionsPage } from '../../lib/storage';
import { useCachedResource } from '../../lib/cache/useCachedResource';
import { cacheKeys } from '../../lib/cache/cacheKeys';
import { cachePolicies } from '../../lib/cache/cachePolicy';

const JOURNAL_PAGE_SIZE = 40;

export interface Session {
  id: string;
  game_id: string;
  platform_id?: number;
  start_time: string | number;
  end_time: string | number;
  duration_minutes?: number;
  duration_seconds?: number;
  mood: string;
  notes: string | string[];
  journal?: string;
}

const appendUniqueSessions = (current: Session[], incoming: Session[]) => {
  const seen = new Set(current.map(session => session.id));
  return [
    ...current,
    ...incoming.filter(session => !seen.has(session.id))
  ];
};

export const useJournal = (filterDate = '') => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [healthSessions, setHealthSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const requestVersionRef = useRef(0);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const libraryResource = useCachedResource<any[]>({
    key: cacheKeys.library,
    fetcher: getLibrary,
    policy: cachePolicies.library,
    initialData: [],
  });

  const games = useMemo(() => {
    const gameMap: Record<string, any> = {};
    (libraryResource.data || []).forEach((g: any) => {
      gameMap[g.id] = g;
    });
    return gameMap;
  }, [libraryResource.data]);

  const loadPage = useCallback(async (reset = false) => {
    if (!reset && loadingRef.current) return;

    loadingRef.current = true;
    const requestVersion = reset ? requestVersionRef.current + 1 : requestVersionRef.current;
    requestVersionRef.current = requestVersion;
    const nextOffset = reset ? 0 : offsetRef.current;

    if (reset) {
      setLoading(true);
      setHasMore(false);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const [page, recent] = await Promise.all([
        getSessionsPage({
          limit: JOURNAL_PAGE_SIZE,
          offset: nextOffset,
          date: filterDate || undefined,
        }),
        reset ? getRecentSessions(7) : Promise.resolve(null),
      ]);

      if (requestVersion !== requestVersionRef.current) return;

      setSessions(previous => reset
        ? page.sessions
        : appendUniqueSessions(previous, page.sessions)
      );
      offsetRef.current = nextOffset + page.sessions.length;
      setHasMore(page.hasMore);

      if (recent) {
        setHealthSessions(recent);
      }
    } catch (error) {
      console.error('Journal fetch failed', error);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      loadingRef.current = false;
    }
  }, [filterDate]);

  useEffect(() => {
    setSessions([]);
    void loadPage(true);
  }, [loadPage]);

  useEffect(() => {
    const onDataUpdate = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || ['session', 'restore', 'reset'].includes(detail.type)) {
        setSessions([]);
        void loadPage(true);
      }
    };

    window.addEventListener('valis-data-update', onDataUpdate);
    return () => window.removeEventListener('valis-data-update', onDataUpdate);
  }, [loadPage]);

  const refresh = useCallback(async () => {
    setSessions([]);
    await Promise.all([
      loadPage(true),
      libraryResource.refresh(),
    ]);
  }, [libraryResource.refresh, loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void loadPage(false);
  }, [hasMore, loadPage, loadingMore]);

  return {
    sessions,
    healthSessions,
    games,
    loading: loading || (libraryResource.loading && sessions.length === 0),
    loadingMore,
    hasMore,
    loadMore,
    refresh
  };
};
