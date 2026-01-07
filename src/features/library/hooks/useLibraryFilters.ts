import { useState, useMemo } from 'react';
import { checkGameHasPlatform } from '../utils/libraryUtils';

export const useLibraryFilters = (games: any[], showDlc: boolean) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterGenre, setFilterGenre] = useState('All');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterTheme, setFilterTheme] = useState('All');
  
  const filteredGames = useMemo(() => {
    let result = [...games];

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

    // ⚡ Filtering logic controlled by showDlc prop
    if (!showDlc) {
        result = result.filter(g => {
            const type = g.game_type ?? g.category;
            // IGDB Categories: 1=DLC, 2=Expansion, 4=Standalone Expansion
            if (type === undefined || type === null) return true;
            return type !== 1 && type !== 2 && type !== 4;
        });
    }

    return result; 
  }, [games, search, filterStatus, filterGenre, filterPlatform, filterTheme, showDlc]);

  return {
    filteredGames,
    search, setSearch,
    filterStatus, setFilterStatus,
    filterGenre, setFilterGenre,
    filterPlatform, setFilterPlatform,
    filterTheme, setFilterTheme
  };
};