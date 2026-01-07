import { useMemo } from 'react';
import { format } from 'date-fns';

function subDays(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
}

export const useHeatmapData = (sessions: any[]) => {
  return useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = subDays(new Date(), 365);

    sessions.forEach(s => {
      const d = new Date(s.start_time);
      if (d >= cutoff) {
        const dateStr = format(d, 'yyyy-MM-dd');
        let minutes = 0;
        if (typeof s.duration_seconds === 'number') minutes = s.duration_seconds / 60;
        else if (typeof s.duration_minutes === 'number') minutes = s.duration_minutes;

        map[dateStr] = (map[dateStr] || 0) + minutes;
      }
    });

    return Object.entries(map).map(([date, minutes]) => ({
      date,
      count: Math.round(minutes / 60 * 10) / 10
    }));
  }, [sessions]);
};