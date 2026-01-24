import { useState, useMemo } from 'react';
import { checkGameHasPlatform } from '../utils/libraryUtils';
import { TagFilters } from '../../../store/libraryStore';

export const useLibraryFilters = (games: any[], showDlc: boolean, tagFilters: TagFilters) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterGenre, setFilterGenre] = useState('All');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterTheme, setFilterTheme] = useState('All');
  
  const filteredGames = useMemo(() => {
    let result = [...games];

    // 1. Core Filters
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g => (g.title || g.name || '').toLowerCase().includes(q));
    }

    if (filterStatus !== 'All') {
      result = result.filter(g => g.status === filterStatus);
    }

    if (filterGenre !== 'All') {
        result = result.filter(g => {
            try {
                const genres = typeof g.genres === 'string' ? JSON.parse(g.genres || '[]') : g.genres || [];
                return genres.some((gen: any) => gen.name === filterGenre);
            } catch { return false; }
        });
    }

    if (filterPlatform !== 'All') {
        result = result.filter(g => checkGameHasPlatform(g, filterPlatform));
    }

    if (filterTheme !== 'All') {
        result = result.filter(g => {
            try {
                const themes = typeof g.themes === 'string' ? JSON.parse(g.themes || '[]') : g.themes || [];
                return themes.some((t: any) => t.name === filterTheme);
            } catch { return false; }
        });
    }

    // 2. DLC Filtering
    if (!showDlc) {
        result = result.filter(g => {
            const type = g.game_type ?? g.category;
            if (type === undefined || type === null) return true;
            return type !== 1 && type !== 2 && type !== 4;
        });
    }

    // 3. TAG FILTERING (v1.1.0 Normalized Tags)
    // Map through results and apply tag logic
    result = result.filter(game => {
      const gameTags = game.tags || []; // From getLibrary join
      const gameTagIds = gameTags.map((t: any) => t.id);

      // A. Exclusion Logic (Highest Priority)
      // If the game has ANY tag in the exclude list, hide it.
      if (tagFilters.exclude.length > 0) {
        const hasExcluded = tagFilters.exclude.some(id => gameTagIds.includes(id));
        if (hasExcluded) return false;
      }

      // B. Inclusion Logic
      // If include list is empty, all remaining games are valid.
      if (tagFilters.include.length === 0) return true;

      // If include list is NOT empty, game must have AT LEAST ONE tag from include.
      return tagFilters.include.some(id => gameTagIds.includes(id));
    });

    return result; 
  }, [games, search, filterStatus, filterGenre, filterPlatform, filterTheme, showDlc, tagFilters]);

  return {
    filteredGames,
    search, setSearch,
    filterStatus, setFilterStatus,
    filterGenre, setFilterGenre,
    filterPlatform, setFilterPlatform,
    filterTheme, setFilterTheme
  };
};