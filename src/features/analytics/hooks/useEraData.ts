import { useMemo } from 'react';

export const useEraData = (library: any[]) => {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    let minYear = 3000;
    let maxYear = 1900;

    library.forEach(g => {
      if (g.first_release_date) {
        const year = new Date(g.first_release_date * 1000).getFullYear();
        if (year > 1970 && year <= new Date().getFullYear() + 2) {
            counts[year] = (counts[year] || 0) + 1;
            if (year < minYear) minYear = year;
            if (year > maxYear) maxYear = year;
        }
      }
    });

    const data = [];
    if (minYear < 3000) {
        for (let y = minYear; y <= maxYear; y++) {
            data.push({ year: y, count: counts[y] || 0 });
        }
    }
    return data;
  }, [library]);
};