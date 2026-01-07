
import { useMemo } from 'react';
import { getTrueTime } from '../utils/libraryUtils';

export const useLibrarySort = (
  processedGames: any[], 
  settings: any, 
  lastPlayedMap: Record<string, number>
) => {
  return useMemo(() => {
    const sorted = [...processedGames].sort((a, b) => {
        const dir = settings.sortDirection === 'asc' ? 1 : -1;

        // Force cast to bypass strict SortOption literal check
        switch (settings.sortBy as any) {
            case 'name':
            case 'alphabetical':
                const nameA = a.name || a.title || '';
                const nameB = b.name || b.title || '';
                return nameA.localeCompare(nameB) * dir;
            
            case 'score':
            case 'rating':
                return ((a.final_score ?? -1) - (b.final_score ?? -1)) * dir;

            case 'time':
            case 'timePlayed':
            case 'playtime':
            case 'total_playtime':
                return (getTrueTime(a) - getTrueTime(b)) * dir;

            case 'release':
            case 'releaseDate':
                return ((a.first_release_date || 0) - (b.first_release_date || 0)) * dir;
            
            case 'lastPlayed':
                return ((lastPlayedMap[a.id] || 0) - (lastPlayedMap[b.id] || 0)) * dir;

            default:
                const timeA = a.added_at || 0;
                const timeB = b.added_at || 0;
                return (timeA - timeB) * dir;
        }
    });
    return sorted;
  }, [processedGames, settings.sortBy, settings.sortDirection, lastPlayedMap]);
};
