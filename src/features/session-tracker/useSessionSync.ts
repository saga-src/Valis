import { useEffect } from 'react';
// Fix: Import useNavigate from local shim index file to avoid casing conflict with App.tsx
import { useNavigate } from '../../app/index';
import { useSessionStore } from './store';
import { getLibrary, onSessionStarted, onSessionEnded } from '../../lib/storage';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';

export const useSessionSync = () => {
  const navigate = useNavigate();
  const { startTimer, stopTimer } = useSessionStore();
  const { reportSignal } = useMarkObserver();

  useEffect(() => {
    // 1. Session Started
    const removeStartListener = onSessionStarted(async (data) => {
      console.log("%c[Frontend] ⚡ RECEIVED START SIGNAL", "color: green; font-weight: bold;", data);
      console.log('[Sync] Watcher started session:', data);
      
      // ⚡ Report Signals for "The Overclocker" and "The Bottleneck"
      // We check hardware stats immediately on launch
      if (window.api && window.api.getSystemStats) {
          try {
              const stats = await window.api.getSystemStats();
              // Pass stats payload to the rules engine
              reportSignal('GAME_LAUNCH', { 
                 ramUsage: stats.memUsed, 
                 cpuLoad: stats.cpuLoad, 
                 gpuLoad: stats.gpuLoad 
              });
          } catch(e) {
              // Fallback simple signal
              reportSignal('GAME_LAUNCH');
          }
      } else {
          reportSignal('GAME_LAUNCH');
      }
      
      // GUARD: If we are already tracking this game manually, don't reset the timer.
      const { activeSession } = useSessionStore.getState();
      if (activeSession && activeSession.gameId === data.gameId) {
        console.log('[Sync] Manual session already active. Ignoring watcher start signal.');
        return;
      }

      try {
        // We need to fetch the game title and cover to populate the active session state
        const library = await getLibrary();
        const game = library.find((g: any) => g.id === data.gameId);
        const title = game ? game.title : 'Unknown Game';
        
        // Start the timer with the specific start time, cover, and sessionId provided by the watcher
        startTimer(data.gameId, title, game?.cover_url, undefined, Number(data.startTime), data.sessionId);

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
      
      // ⚡ Report Signal for "Touch Grass" check
      reportSignal('GAME_CLOSE');

      // Stop the timer locally. 
      // The backend has already saved the session record.
      // `stopTimer` clears activeSession and updates `lastUpdate` to trigger refetches.
      const currentSession = useSessionStore.getState().activeSession;
      
      // Only stop if the ended game matches the active one (safety check)
      if (!currentSession || currentSession.gameId === data.gameId) {
          stopTimer();
      }
    });

    // Cleanup listeners on unmount
    return () => {
      removeStartListener();
      removeEndListener();
    };
  }, [navigate, startTimer, stopTimer, reportSignal]);
};