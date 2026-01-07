import { useCallback } from 'react';
import { useGamification } from './useGamification'; 
import { MARK_RULES, MarkSignal, updateMarkSessionState } from '../logic/markRules';
import { GENERAL_MARKS } from '../logic/generalMarks';
import { useTheme } from '../../../lib/theme';

export const useMarkObserver = () => {
  const { unlockedMarks, unlockMark, metrics } = useGamification();
  const { theme } = useTheme();

  const reportSignal = useCallback((signal: MarkSignal, payload?: any) => {
    
    // 1. Handle Special Session State (Touch Grass)
    if (signal === 'TOUCH_GRASS_ALERT') {
        updateMarkSessionState('touchGrassTriggered', true);
        updateMarkSessionState('touchGrassTime', Date.now());
    }

    // 2. Filter relevant rules
    // Only check rules for marks we haven't unlocked yet
    const relevantRules = MARK_RULES.filter(
      r => r.signal === signal && !unlockedMarks.includes(r.markId)
    );

    // 3. Construct Context State for Rules
    // This maps the various app states into the structure expected by markRules.ts
    const contextState = {
        theme,
        stats: metrics, // Maps backend metrics (total_games, etc) to 'stats'
        library: {
            totalGames: metrics['total_games'] || 0
        },
        session: {
            lastStealthDuration: 0, // Not fully tracked on frontend yet
            currentDataViewDuration: 0 // Handled via payload usually
        },
        hardware: {
            ramUsage: payload?.ramUsage || 0 // Handled via payload usually
        },
        settings: {
            isHardwareMonitorPinned: false // Handled via payload usually
        }
    };

    // 4. Check Conditions
    relevantRules.forEach(rule => {
      // Pass payload (event specific data) and context (global state)
      const isUnlocked = rule.check(payload, contextState);

      if (isUnlocked) {
        unlockMark(rule.markId);
        
        const badge = GENERAL_MARKS.find(m => m.id === rule.markId);
        if (badge) {
            // Dispatch Custom Event for the Notifier to handle visual/audio
            const event = new CustomEvent('unlock_protocol', { detail: badge });
            window.dispatchEvent(event);
        }
      }
    });

  }, [unlockedMarks, unlockMark, metrics, theme]);

  return { reportSignal };
};