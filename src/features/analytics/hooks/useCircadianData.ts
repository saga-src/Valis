
import { useMemo } from 'react';
import { format } from 'date-fns';

export const useCircadianData = (sessions: any[]) => {
  return useMemo(() => {
    // Initialize 24 buckets
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: format(new Date().setHours(i, 0, 0, 0), 'ha'), // e.g., "2AM"
      durationSeconds: 0,
      sessionCount: 0
    }));

    sessions.forEach(session => {
      if (!session.start_time) return;
      
      const date = new Date(session.start_time);
      const hour = date.getHours();
      
      let duration = 0;
      if (typeof session.duration_seconds === 'number') {
        duration = session.duration_seconds;
      } else if (typeof session.duration_minutes === 'number') {
        duration = session.duration_minutes * 60;
      }

      if (buckets[hour]) {
        buckets[hour].durationSeconds += duration;
        buckets[hour].sessionCount += 1;
      }
    });

    let maxDuration = 0;
    let maxCount = 0;

    const data = buckets.map(b => {
      // Convert to hours for duration
      const realDuration = Math.round((b.durationSeconds / 3600) * 10) / 10;
      
      if (realDuration > maxDuration) maxDuration = realDuration;
      if (b.sessionCount > maxCount) maxCount = b.sessionCount;

      return {
        hour: b.hour,
        label: b.label,
        value: 1, // Normalized slice size for Pie chart (always 1)
        realDuration: realDuration, // Actual hours played
        realCount: b.sessionCount   // Actual number of sessions
      };
    });

    return { 
      data, 
      maxDuration: Math.max(maxDuration, 1), // Avoid division by zero
      maxCount: Math.max(maxCount, 1) 
    };
  }, [sessions]);
};
