import { useMemo } from 'react';

export const useScatterData = (library: any[], gamePlaytimeMap: Record<string, number>) => {
  return useMemo(() => {
    return library
      .filter(g => typeof g.final_score === 'number' && g.final_score > 0)
      .map(g => {
        const minutes = gamePlaytimeMap[g.id] || 0;
        return {
          id: g.id,
          name: g.title,
          x: Math.round(minutes / 60 * 10) / 10,
          y: g.final_score,
          z: 1
        };
      })
      .filter(d => d.x > 0);
  }, [library, gamePlaytimeMap]);
};