import { useEffect } from 'react';
// Fix: Import useNavigate from local shim index file to avoid casing conflict with App.tsx
import { useNavigate } from '../../app/index';
import { useSessionStore } from './store';
import { getLibrary, onSessionStarted, onSessionEnded } from '../../lib/storage';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';

export const useSessionSync = () => {
  const navigate = useNavigate();
  const { startTimer, handlePersistedEnd, recoverActiveSession } = useSessionStore();
  const { reportSignal } = useMarkObserver();

  useEffect(() => {
    void recoverActiveSession();
    // 1. Session Started
    const removeStartListener = onSessionStarted(async (data) => {
      console.log("%c[Frontend] ⚡ RECEIVED START SIGNAL", "color: green; font-weight: bold;", data);
      console.log('[Sync] Watcher started session:', data);
      
      // GUARD: If we are already tracking this game manually, don't reset the timer.
      const { activeSession } = useSessionStore.getState();
      if (activeSession?.sessionId === data.sessionId) {
        console.log('[Sync] Manual session already active. Ignoring watcher start signal.');
        return;
      }

      try {
        // We need to fetch the game title and cover to populate the active session state
        const library = await getLibrary();
        const game = library.find((g: any) => g.id === data.gameId);
        const title = game ? game.title : 'Unknown Game';
        
        // Start the timer with the specific start time, cover, and sessionId provided by the watcher
        const attached = await startTimer(data.gameId, title, game?.cover_url, undefined, Number(data.startTime), data.sessionId);
        if (!attached) return;

        // A repeated watcher notification for an already attached ID does not
        // count as another game launch.
        if (window.api?.getSystemStats) {
          try {
            const stats = await window.api.getSystemStats();
            reportSignal('GAME_LAUNCH', {
              ramUsage: stats.memUsed,
              cpuLoad: stats.cpuLoad,
              gpuLoad: stats.gpuLoad
            });
          } catch {
            reportSignal('GAME_LAUNCH');
          }
        } else {
          reportSignal('GAME_LAUNCH');
        }

        // Force navigation to the active session view so the user sees the timer
        console.log("Navigating to /play...");
        navigate('/play', { state: { gameId: data.gameId } });

      } catch (e) {
        console.error('[Sync] Failed to start synced session:', e);
      }
    });

    // 2. Session Ended
    const removeEndListener = onSessionEnded((data) => {
      console.log("%c[Frontend] 🛑 RECEIVED END SIGNAL", "color: red; font-weight: bold;", data);
      console.log('[Sync] Watcher ended session:', data);
      
      const currentSession = useSessionStore.getState().activeSession;
      if (currentSession?.sessionId === data.sessionId) {
          reportSignal('GAME_CLOSE');
          void handlePersistedEnd(data.sessionId);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      removeStartListener();
      removeEndListener();
    };
  }, [navigate, startTimer, handlePersistedEnd, recoverActiveSession, reportSignal]);
};
