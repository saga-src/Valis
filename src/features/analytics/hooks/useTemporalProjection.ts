
import { useMemo } from 'react';
import { subMonths, isAfter } from 'date-fns';

export const useTemporalProjection = (library: any[], sessions: any[]) => {
  return useMemo(() => {
    // 1. Calculate Backlog Size
    // Games that are 'Backlog' or 'Playing' (Not Beat, Completed, Dropped, or Shelved)
    const backlogCount = library.filter(g => 
      g.status === 'Backlog' || g.status === 'Playing'
    ).length;

    if (backlogCount === 0) {
      return { velocity: 0, remainingGames: 0, estimatedDate: null, isClear: true };
    }

    // 2. Calculate Velocity (Games beaten in last 12 months)
    const oneYearAgo = subMonths(new Date(), 12);
    
    // Determine when games were beaten based on their last session or updated_at
    let gamesBeatenLastYear = 0;

    library.filter(g => g.status === 'Beat' || g.status === 'Completed').forEach(game => {
      // Find completion date
      const gameSessions = sessions
        .filter(s => s.game_id === game.id)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      
      const completionTime = gameSessions.length > 0 
          ? new Date(gameSessions[0].start_time) 
          : new Date(game.updated_at || 0);

      if (isAfter(completionTime, oneYearAgo)) {
        gamesBeatenLastYear++;
      }
    });

    // Velocity = Games / Month
    const velocity = gamesBeatenLastYear / 12;

    if (velocity <= 0) {
       return { velocity: 0, remainingGames: backlogCount, estimatedDate: null, isClear: false };
    }

    // 3. Project Completion
    const monthsRemaining = backlogCount / velocity;
    
    // Add months to current date
    const today = new Date();
    // Crude month addition to get timestamp
    const futureMs = today.getTime() + (monthsRemaining * 30.44 * 24 * 60 * 60 * 1000);
    const estimatedDate = new Date(futureMs);

    return {
      velocity: Math.round(velocity * 10) / 10, // Round to 1 decimal
      remainingGames: backlogCount,
      estimatedDate,
      isClear: false
    };

  }, [library, sessions]);
};
