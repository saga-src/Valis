import { useEffect, useRef } from 'react';
import { useLibraryStore } from '../../../store/libraryStore';

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
          window.api.getSetting('library_tag_filters'),
          window.api.getTags()
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
          await window.api.saveSetting({ key: 'library_tag_filters', value: tagFilters });
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
      setTags(availableTags);
    }
  };

  return { refreshTags };
};