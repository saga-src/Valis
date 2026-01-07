import { useCallback } from 'react';
import { getTotalPlaytimeSeconds } from '../../../lib/utils/format';
import { CUSTOM_PLATFORM_DATA, CUSTOM_PLATFORMS } from '../../../types/index';

const parse = (json: any) => {
  try { return typeof json === 'string' ? JSON.parse(json) : json || []; } catch { return []; }
};

export const useRadarData = (library: any[]) => {
  return useCallback((
    dimension: string, 
    metric: 'count' | 'time',
    mergePc: boolean = true
  ) => {
    const counts: Record<string, number> = {};
    
    library.forEach(game => {
      // 1. Determine Weight
      let weight = 1;
      if (metric === 'time') {
          const totalSeconds = getTotalPlaytimeSeconds(game);
          weight = totalSeconds / 3600; // Hours
          if (weight === 0) return; // Skip 0 hours games for time metric
      }

      // 2. Extract Items based on Dimension
      let items: string[] = [];

      if (dimension === 'platforms') {
        // Platform Logic
        const ownedIds = parse(game.owned_platform_ids);
        
        if (ownedIds.length > 0) {
            items = ownedIds.map((id: number) => {
                // Check PC Merge
                if (mergePc) {
                    const pcIds = [
                        6, // IGDB PC
                        CUSTOM_PLATFORMS.STEAM,
                        CUSTOM_PLATFORMS.EPIC,
                        CUSTOM_PLATFORMS.GOG,
                        CUSTOM_PLATFORMS.XBOX_PC,
                        CUSTOM_PLATFORMS.STANDALONE,
                        CUSTOM_PLATFORMS.STEAM_TOOLS,
                        CUSTOM_PLATFORMS.UNOFFICIAL
                    ];
                    if (pcIds.includes(Number(id))) return 'PC';
                }
                
                // Name Resolution
                if (CUSTOM_PLATFORM_DATA[id]) return CUSTOM_PLATFORM_DATA[id].name;
                
                // Fallback to Metadata search
                const metaPlatforms = parse(game.platforms);
                const match = metaPlatforms.find((p: any) => p.id === id);
                return match ? (match.abbreviation || match.name) : `ID:${id}`;
            });
        } else {
            // Fallback to Metadata if no ownership details (e.g. Wishlist items)
            // Usually we analyze library, so this might be rare for 'played' games
            const metaPlatforms = parse(game.platforms);
            items = metaPlatforms.map((p: any) => {
               if (mergePc && p.id === 6) return 'PC';
               return p.abbreviation || p.name;
            });
        }
      } else {
        // Metadata Logic (Genres, Themes, etc)
        // Dimension keys match DB column names: 'genres', 'themes', 'player_perspectives', 'game_modes'
        const metaItems = parse(game[dimension]);
        items = metaItems.map((item: any) => item.name || item);
      }

      // 3. Aggregate
      // Deduplicate items per game (e.g. if a game is on Steam AND Epic, and we merge PC, it counts as 1 PC entry for this game)
      const uniqueItems = new Set(items);
      uniqueItems.forEach(item => {
        if (item) {
          counts[item] = (counts[item] || 0) + weight;
        }
      });
    });

    // 4. Transform for Chart
    const maxVal = Math.max(...Object.values(counts), 0);
    // Sort descending and take top 6 for readability on Radar
    return Object.entries(counts)
      .map(([subject, value]) => ({ 
        subject, 
        value: Number(value.toFixed(1)), 
        fullMark: Math.ceil(maxVal * 1.1) || 10
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [library]);
};
