
import { useState, useEffect } from 'react';
import { useSessionStore } from './store';
import { System } from '../../lib/api';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';
import { useSocialBroadcast } from '../social/hooks/useSocialBroadcast';
import { useAutoSync } from '../settings/hooks/useAutoSync';
import { supabase } from '../../lib/cloud/supabase';
import { useAuth } from '../../context/AuthContext';
import { CUSTOM_PLATFORM_DATA } from '../../types/index';
import { calculateAndSyncObsession } from '../analytics/logic/obsessionCalculator';

export const useSessionManager = () => {
  const store = useSessionStore();
  const [elapsed, setElapsed] = useState(0);
  const { reportSignal } = useMarkObserver();
  const { broadcastSession } = useSocialBroadcast();
  const { performCloudUpload } = useAutoSync();
  const { user } = useAuth();

  // Trace data flow for active sessions
  useEffect(() => {
    if (store.activeSession) {
      System.log("Session Manager Tracking Active Session:", {
        game: store.activeSession.gameTitle,
        id: store.activeSession.gameId,
        startTime: store.activeSession.startTime,
        sessionId: store.activeSession.sessionId
      });
    } else {
      System.log("Session Manager: No active session tracked.");
    }
  }, [store.activeSession]);

  useEffect(() => {
    if (!store.activeSession) {
      setElapsed(0);
      return;
    }

    // Update immediately on mount/change
    setElapsed(Date.now() - store.activeSession.startTime);

    const interval = setInterval(() => {
      if (store.activeSession) {
        setElapsed(Date.now() - store.activeSession.startTime);
      }
    }, 1000);

    // Specific ticker for Gamification (Every 60s)
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
    // 1. Capture Data Snapshot
    const currentSession = store.activeSession;
    if (!currentSession) return;

    // Capture draft notes before they are cleared by stopTimer
    const currentNotes = store.draft.notes; 

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - currentSession.startTime) / 1000);
    const durationMinutes = durationSeconds / 60;

    console.log(`[SessionManager] Stopping session for ${currentSession.gameTitle}. Duration: ${durationSeconds}s`);

    // 2. Stop UI Immediately (Optimistic Update)
    await store.stopTimer();

    // 3. Background Network Operations (Fire-and-Forget)
    void (async () => {
        // --- A. Local XP Calculation ---
        let xpEarned = Math.floor(durationSeconds / 3600) * 10;
        if (xpEarned === 0 && durationMinutes > 10) {
            xpEarned = 1;
        }

        // --- B. Local API Fallback (Guest/Offline) ---
        if (window.api && window.api.addPlaytimeXP && xpEarned > 0) {
            window.api.addPlaytimeXP(xpEarned).catch(err => console.error("Local XP update failed:", err));
        }

        // --- C. Cloud Broadcasts ---
        if (user) {
            try {
                // Resolve Game Data
                let activeGame: any = null;
                if (window.api && window.api.getGameById) {
                     try {
                         activeGame = await window.api.getGameById(currentSession.gameId);
                     } catch (e) {
                         console.warn('[SessionManager] Failed to resolve game for broadcast:', e);
                     }
                }

                if (durationSeconds > 1) {
                    if (activeGame) {
                        // Resolve platform name
                        let platformName = activeGame.platform || 'Unknown';
                        if (currentSession.platformId && CUSTOM_PLATFORM_DATA[currentSession.platformId]) {
                            platformName = CUSTOM_PLATFORM_DATA[currentSession.platformId].name;
                        }

                        const activityData = {
                            game: activeGame.title || activeGame.name,
                            duration: durationSeconds,
                            cover_url: activeGame.cover_url || activeGame.cover?.url || '',
                            game_id: activeGame.igdb_id || activeGame.id,
                            platform: platformName,
                            notes: currentNotes, // Use captured notes
                            xp: xpEarned,           // <--- Added
                            mood: store.draft.mood  // <--- Added
                        };

                        const { error: feedError } = await supabase.from('activities').insert({
                            user_id: user.id,
                            game_id: activeGame.id,
                            type: 'session',
                            happened_at: new Date().toISOString(),
                            data: activityData
                        });

                        if (feedError) console.error('[SessionManager] Activity Feed Insert Failed:', feedError);
                    } else {
                        // Fallback Broadcast
                        await broadcastSession(currentSession.gameTitle, durationSeconds, currentSession.coverUrl);
                    }
                }

                // --- D. Parallel Leaderboards & Stats ---
                if (durationSeconds > 5) {
                    const tasks: Promise<any>[] = [];

                    // 1. Global Leaderboard
                    tasks.push(
                        supabase.rpc('update_leaderboard', {
                            p_category: 'playtime',
                            p_sub_category: 'global',
                            p_increment: durationSeconds
                        }).then(({ error }) => error && console.warn('[SessionManager] Global LB failed:', error.message))
                    );

                    // 2. Genre Leaderboards
                    if (activeGame && activeGame.genres) {
                        let genres: any[] = [];
                        try {
                            genres = typeof activeGame.genres === 'string' ? JSON.parse(activeGame.genres) : activeGame.genres;
                        } catch { /* ignore */ }

                        if (Array.isArray(genres)) {
                            for (const g of genres) {
                                const genreName = typeof g === 'string' ? g : g.name;
                                if (genreName) {
                                    tasks.push(
                                        supabase.rpc('update_leaderboard', {
                                            p_category: 'playtime',
                                            p_sub_category: genreName,
                                            p_increment: durationSeconds
                                        })
                                    );
                                }
                            }
                        }
                    }

                    // 3. Player Stats & XP
                    tasks.push(
                        supabase.rpc('update_player_stats', {
                            playtime: durationSeconds,
                            xp: xpEarned
                        }).then(({ error }) => error && console.error('[SessionManager] Stats Update Failed:', error))
                    );

                    await Promise.all(tasks);
                    console.log(`[SessionManager] Background sync complete: ${durationSeconds}s, ${xpEarned} XP`);
                    
                    // 4. Update Obsession
                    await calculateAndSyncObsession(user.id);
                }
            } catch (err) {
                console.error('[SessionManager] Background sync critical error:', err);
            }
        }
    })();

    // 4. Trigger Cloud Backup (Delayed)
    setTimeout(() => {
      performCloudUpload().catch(err => console.error("Auto-backup failed:", err));
    }, 5000);
  };

  return {
    ...store,
    stopTimer: handleStopTimer,
    elapsed,
    isActive: !!store.activeSession,
  };
};
