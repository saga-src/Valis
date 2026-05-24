import { useEffect, useRef } from 'react';
import { useLibraryStore } from '../../../store/libraryStore';
import { getSetting, saveSetting } from '../../../lib/storage';
import { useCacheStore } from '../../../store/cacheStore';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies } from '../../../lib/cache/cachePolicy';

const getCachedTags = async () => {
  const cache = useCacheStore.getState();
  const key = cacheKeys.tags;
  if (cache.isFresh(key)) return cache.getEntry<any[]>(key)?.data || [];
  cache.setLoading(key, cachePolicies.tags);
  try {
    const tags = await window.api.getTags();
    cache.setEntry(key, tags || [], cachePolicies.tags);
    return tags || [];
  } catch (error) {
    cache.setError(key, error, cachePolicies.tags);
    throw error;
  }
};

export const useTagFilters = () => {
  const { tagFilters, setTagFilters, setTags } = useLibraryStore();
  const isInitialMount = useRef(true);
  // Fixed: Using ReturnType<typeof setTimeout> to avoid NodeJS.Timeout issues in browser context
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Load filters and tags on mount
  useEffect(() => {
    const init = async () => {
      if (!window.api) return;

      try {
        const [savedFilters, availableTags] = await Promise.all([
          getSetting('library_tag_filters'),
          getCachedTags()
        ]);

        if (savedFilters) {
          setTagFilters(typeof savedFilters === 'string' ? JSON.parse(savedFilters) : savedFilters);
        }
        
        if (availableTags) {
          setTags(availableTags);
        }
      } catch (error) {
        console.error('[useTagFilters] Init failed:', error);
      } finally {
        isInitialMount.current = false;
      }
    };

    init();
  }, [setTagFilters, setTags]);

  // 2. Persist filters on change with debounce
  useEffect(() => {
    if (isInitialMount.current) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      if (window.api) {
        try {
          // Fixed: window.api.saveSetting expects a single object payload { key, value }
          await saveSetting('library_tag_filters', tagFilters);
          console.log('[useTagFilters] Persisted filters to DB');
        } catch (error) {
          console.error('[useTagFilters] Save failed:', error);
        }
      }
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [tagFilters]);

  const refreshTags = async () => {
    if (window.api) {
      const availableTags = await window.api.getTags();
      useCacheStore.getState().setEntry(cacheKeys.tags, availableTags || [], cachePolicies.tags);
      setTags(availableTags);
    }
  };

  return { refreshTags };
};
