
import { useState, useEffect } from 'react';
import { useSessionStore } from './store';
import { System } from '../../lib/api';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';
import { useSocialBroadcast } from '../social/hooks/useSocialBroadcast';
import { supabase } from '../../lib/cloud/supabase';
import { useAuth } from '../../context/AuthContext';
import { CUSTOM_PLATFORM_DATA } from '../../types/index';
import { calculateAndSyncObsession } from '../analytics/logic/obsessionCalculator';

export const useSessionManager = () => {
  const store = useSessionStore();
  const [elapsed, setElapsed] = useState(0);
  const { reportSignal } = useMarkObserver();
  const { broadcastSession } = useSocialBroadcast();
  const { user } = useAuth();

  useEffect(() => {
    if (store.activeSession) {
      System.log("Session Manager Tracking Active Session:", {
        game: store.activeSession.gameTitle,
        id: store.activeSession.gameId,
        startTime: store.activeSession.startTime,
        sessionId: store.activeSession.sessionId
      });
    }
  }, [store.activeSession]);

  useEffect(() => {
    if (!store.activeSession) {
      setElapsed(0);
      return;
    }

    setElapsed(Date.now() - store.activeSession.startTime);

    const interval = setInterval(() => {
      if (store.activeSession) {
        setElapsed(Date.now() - store.activeSession.startTime);
      }
    }, 1000);

    const gameTicker = setInterval(() => {
        if (store.activeSession) {
            reportSignal('PLAYTIME_TICK');
        }
    }, 60000);

    return () => {
        clearInterval(interval);
        clearInterval(gameTicker);
    };
  }, [store.activeSession, reportSignal]);

  const handleStopTimer = async () => {
    const currentSession = store.activeSession;
    if (!currentSession) return;
    const currentNotes = store.draft.notes; 
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - currentSession.startTime) / 1000);

    await store.stopTimer();

    void (async () => {
        let xpEarned = Math.floor((durationSeconds / 60) * 0.2);
        if (xpEarned === 0 && durationSeconds > 300) xpEarned = 1;

        if (window.api && window.api.addPlaytimeXP && xpEarned > 0) {
            window.api.addPlaytimeXP(xpEarned).catch(err => console.error("Local XP update failed:", err));
        }

        if (user) {
            try {
                let activeGame: any = null;
                if (window.api && window.api.getGameById) {
                     try { activeGame = await window.api.getGameById(currentSession.gameId); } catch (e) {}
                }

                if (durationSeconds > 1) {
                    let platformName = activeGame?.platform || 'Unknown';
                    if (currentSession.platformId && CUSTOM_PLATFORM_DATA[currentSession.platformId]) {
                        platformName = CUSTOM_PLATFORM_DATA[currentSession.platformId].name;
                    }

                    // Use updated broadcast method
                    broadcastSession(
                        activeGame?.title || activeGame?.name || currentSession.gameTitle,
                        durationSeconds,
                        xpEarned,
                        platformName,
                        activeGame?.cover_url || currentSession.coverUrl
                    );
                }

                if (durationSeconds > 5) {
                    const tasks: Promise<any>[] = [];
                    tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: durationSeconds }));
                    
                    if (activeGame && activeGame.genres) {
                        let genres: any[] = [];
                        try { genres = typeof activeGame.genres === 'string' ? JSON.parse(activeGame.genres) : activeGame.genres; } catch {}
                        if (Array.isArray(genres)) {
                            for (const g of genres) {
                                const genreName = typeof g === 'string' ? g : g.name;
                                if (genreName) {
                                    tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: genreName, p_increment: durationSeconds }));
                                }
                            }
                        }
                    }

                    tasks.push(supabase.rpc('update_player_stats', { playtime: durationSeconds, xp: xpEarned }));
                    await Promise.all(tasks);
                    await calculateAndSyncObsession(user.id);
                }
            } catch (err) {
                console.error('[SessionManager] Background sync critical error:', err);
            }
        }
    })();

  };

  return {
    ...store,
    stopTimer: handleStopTimer,
    elapsed,
    isActive: !!store.activeSession,
  };
};
