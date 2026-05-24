import { useCallback, useEffect } from 'react';
import { useCacheStore, type CacheEntry, type CachePolicy } from '../../store/cacheStore';

interface UseCachedResourceOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  policy?: CachePolicy;
  enabled?: boolean;
  initialData?: T;
  keepStaleWhileLoading?: boolean;
}

const inFlight = new Map<string, Promise<unknown>>();

export function useCachedResource<T>({
  key,
  fetcher,
  policy,
  enabled = true,
  initialData,
  keepStaleWhileLoading = true,
}: UseCachedResourceOptions<T>) {
  const entry = useCacheStore((state) => state.entries[key] as CacheEntry<T> | undefined);
  const setEntry = useCacheStore((state) => state.setEntry);
  const setLoading = useCacheStore((state) => state.setLoading);
  const setError = useCacheStore((state) => state.setError);
  const invalidate = useCacheStore((state) => state.invalidate);
  const isFresh = useCacheStore((state) => state.isFresh);

  const load = useCallback(async (options?: { force?: boolean }) => {
    if (!enabled) return entry?.data ?? initialData;
    const force = options?.force ?? false;
    if (!force && isFresh(key)) {
      return useCacheStore.getState().entries[key]?.data as T | undefined;
    }

    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    setLoading(key, policy);
    const promise = fetcher()
      .then((data) => {
        setEntry(key, data, policy);
        return data;
      })
      .catch((error) => {
        setError(key, error, policy);
        throw error;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  }, [enabled, entry?.data, fetcher, initialData, isFresh, key, policy, setEntry, setError, setLoading]);

  useEffect(() => {
    if (!enabled) return;
    if (entry?.status === 'success' && isFresh(key)) return;
    void load().catch(() => {});
  }, [enabled, entry?.status, entry?.version, isFresh, key, load]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  const invalidateResource = useCallback(() => invalidate(key), [invalidate, key]);

  const hasData = entry?.data !== undefined && entry?.data !== null;
  const data = hasData ? entry.data as T : initialData;
  const loading = enabled && entry?.status === 'loading' && (!keepStaleWhileLoading || !hasData);

  return {
    data,
    loading,
    error: entry?.error ?? null,
    status: entry?.status ?? 'idle',
    refresh,
    invalidate: invalidateResource,
    entry,
  };
}
