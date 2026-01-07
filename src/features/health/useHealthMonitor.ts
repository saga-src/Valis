import { useEffect, useRef } from 'react';
import { useSessionStore } from '../session-tracker/store';
import { useSettings } from '../settings/useSettings';
import { triggerHealthAlert } from './notifications';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';

export const useHealthMonitor = () => {
  const { activeSession } = useSessionStore();
  const { healthCheckEnabled, healthThreshold, healthSound, healthToast } = useSettings();
  const { reportSignal } = useMarkObserver();
  
  // Track the last time we notified to avoid spamming alerts in the same minute
  const lastCheckpointRef = useRef<number>(0);

  useEffect(() => {
    // If no session or disabled, clear tracking
    if (!activeSession || !healthCheckEnabled) {
      lastCheckpointRef.current = 0;
      return;
    }

    const checkInterval = setInterval(() => {
        if (!activeSession) return;

        const now = Date.now();
        // Calculate minutes elapsed
        const elapsedMinutes = Math.floor((now - activeSession.startTime) / 60000);

        // Check if we hit a threshold multiple (e.g. 30, 60, 90...)
        // Only trigger if we have a valid threshold and positive elapsed time
        if (elapsedMinutes > 0 && healthThreshold > 0 && elapsedMinutes % healthThreshold === 0) {
            // Ensure we haven't already notified for this specific minute marker
            if (lastCheckpointRef.current !== elapsedMinutes) {
                triggerHealthAlert(healthSound, healthToast, elapsedMinutes);
                
                // ⚡ Report Signal for Gamification
                reportSignal('TOUCH_GRASS_ALERT');

                lastCheckpointRef.current = elapsedMinutes;
            }
        }
    }, 5000); // Check every 5 seconds is sufficient to catch the minute transition

    return () => clearInterval(checkInterval);
  }, [activeSession, healthCheckEnabled, healthThreshold, healthSound, healthToast, reportSignal]);
};