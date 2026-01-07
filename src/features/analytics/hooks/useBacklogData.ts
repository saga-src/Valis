
import { useMemo } from 'react';
import { format, startOfMonth, getTime } from 'date-fns';

interface TimelineEvent {
  date: number;
  type: 'added' | 'completed';
}

export const useBacklogData = (library: any[], sessions: any[]) => {
  return useMemo(() => {
    const events: TimelineEvent[] = [];
    
    // Filter out "Endless" games from the backlog calc entirely
    const validGames = library.filter(g => g.status !== 'Endless');

    // 1. Process Library for 'Added' events
    validGames.forEach(game => {
      // Prefer added_at, fallback to release date, fallback to now
      const date = game.added_at || (game.first_release_date ? game.first_release_date * 1000 : Date.now());
      events.push({ date, type: 'added' });

      // 2. Process 'Completed' events
      // Check strict dates first
      let completionDate: number | null = null;
      
      if (game.date_beaten) completionDate = game.date_beaten;
      else if (game.date_completed) completionDate = game.date_completed;
      
      // Fallback: If no explicit date but status is "Beat" or "Completed"
      else if (game.status === 'Beat' || game.status === 'Completed') {
        // Find the last session for this game to determine completion date
        const gameSessions = sessions
          .filter(s => s.game_id === game.id)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

        completionDate = gameSessions.length > 0 
          ? new Date(gameSessions[0].start_time).getTime() 
          : (game.updated_at || Date.now());
      }

      if (completionDate) {
        events.push({ date: completionDate, type: 'completed' });
      }
    });

    // 3. Sort chronologically
    events.sort((a, b) => a.date - b.date);

    // 4. Aggregate by Month
    const monthlyData: Record<string, { added: number; completed: number; timestamp: number }> = {};

    let runningAdded = 0;
    let runningCompleted = 0;

    events.forEach(e => {
      const monthKey = format(new Date(e.date), 'yyyy-MM');
      const monthStart = startOfMonth(new Date(e.date)).getTime();

      if (e.type === 'added') runningAdded++;
      if (e.type === 'completed') runningCompleted++;

      // We only store the *final* running count for that month
      // (This will be overwritten by subsequent events in the same month, which is desired)
      monthlyData[monthKey] = {
        added: runningAdded,
        completed: runningCompleted,
        timestamp: monthStart
      };
    });

    // 5. Fill gaps and format array
    const result = Object.entries(monthlyData)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([key, val]) => ({
        date: key,
        formattedDate: format(new Date(val.timestamp), 'MMM yy'),
        Acquired: val.added,
        Beaten: val.completed,
        Backlog: val.added - val.completed
      }));

    return result;
  }, [library, sessions]);
};
