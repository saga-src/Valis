
import { useState, useEffect, useCallback } from 'react';
import { LEVELS } from '../logic/types';
import { System } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';
import { PROGRESSION_TREE } from '../logic/milestones';
import { useCacheStore } from '../../../store/cacheStore';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies } from '../../../lib/cache/cachePolicy';

interface GamificationState {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  metrics: Record<string, number>;
  unlockedTiers: string[];
  unlockedMarks: string[]; 
  tree: any[]; 
  loading: boolean;
}

export const useGamification = () => {
  const { user } = useAuth();
  
  const [state, setState] = useState<GamificationState>({
    level: 1,
    currentXP: 0,
    nextLevelXP: 500,
    metrics: {},
    unlockedTiers: [],
    unlockedMarks: [], 
    tree: [], 
    loading: true
  });

  const refresh = useCallback(async () => {
    try {
      if (window.api && window.api.getGamificationStatus) {
        const cache = useCacheStore.getState();
        const cacheKey = cacheKeys.gamificationStatus;
        let data = cache.isFresh(cacheKey)
          ? cache.getEntry<any>(cacheKey)?.data
          : null;

        if (!data) {
          data = await window.api.getGamificationStatus();
          cache.setEntry(cacheKey, data, cachePolicies.gamification);
        }
        const { metrics, totalXP, unlockedTiers, unlockedMarks, tree } = data;

        // Calculate Level based on Total XP using LEVELS definition
        let currentLevelDef = LEVELS[0];
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (totalXP >= LEVELS[i].minXP) {
                currentLevelDef = LEVELS[i];
                break;
            }
        }

        const level = currentLevelDef.level;
        const nextLevelXP = currentLevelDef.maxXP;
        
        setState({
            level,
            currentXP: totalXP,
            nextLevelXP: nextLevelXP,
            metrics,
            unlockedTiers: unlockedTiers || [],
            unlockedMarks: unlockedMarks || [], 
            tree: tree || [], 
            loading: false
        });
      }
    } catch (error) {
      console.error("Failed to sync protocol:", error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const unlockMark = useCallback(async (markId: string) => {
    // Avoid spamming if already unlocked
    if (state.unlockedMarks.includes(markId)) return;

    // Optimistic Update
    setState(prev => ({
        ...prev,
        unlockedMarks: [...prev.unlockedMarks, markId]
    }));

    try {
        if (window.api && window.api.unlockMark) {
            await window.api.unlockMark(markId);
            System.log(`[Gamification] Mark unlocked: ${markId}`);
            useCacheStore.getState().invalidate(cacheKeys.gamificationStatus);
            
            // Sync to Cloud
            if (user) {
                PlayerStatsService.unlockArtifact(user.id, markId).catch(console.error);
            }

            // Refresh to ensure sync
            refresh();
        }
    } catch (e) {
        console.error("Failed to unlock mark:", e);
    }
  }, [refresh, user, state.unlockedMarks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh, unlockMark };
};

// Global Watcher Component (Heads-up Sync)
export const GamificationWatcher = () => {
  const { refresh } = useGamification();
  const { user } = useAuth();

  useEffect(() => {
    // Initial Sync
    refresh();

    let removeSessionListener = () => {};
    let removeMilestoneListener = () => {};

    // Listen to session end
    if (window.api && window.api.onSessionEnded) {
        removeSessionListener = window.api.onSessionEnded(() => {
          console.log('[Gamification] Session ended. Syncing progress...');
          refresh();
        });
    }

    // Listen to Milestone Unlocks (for Cloud Sync)
    if (window.api && window.api.onMilestoneUnlocked && user) {
        removeMilestoneListener = window.api.onMilestoneUnlocked((data: any) => {
            // data: { title, archetype, discipline, level, xp, maxRanks, iconName }
            
            // Resolve precise IDs from the static tree
            let archetypeId = '';
            let disciplineId = '';

            for (const arch of PROGRESSION_TREE) {
                if (arch.name === data.archetype) {
                    archetypeId = arch.id;
                    const disc = arch.disciplines.find(d => d.name === data.discipline);
                    if (disc) {
                        disciplineId = disc.id;
                    }
                }
            }

            // Fallback if names match (unlikely with tree sync, but safe)
            if (!disciplineId) disciplineId = data.discipline || 'unknown';
            if (!archetypeId) archetypeId = data.archetype || 'unknown';
            
            PlayerStatsService.updateMilestone(user.id, {
                key: disciplineId, // Store specific ID (e.g. "collector")
                label: data.discipline, // Readable name
                rank: data.level,
                archetype: archetypeId // Store archetype ID
            }).catch(err => console.error('[Gamification] Milestone sync failed:', err));
        });
    }

    // Listen to generic data updates (manual trigger or generic event)
    const handleUpdate = () => refresh();
    window.addEventListener('valis-data-update', handleUpdate);

    return () => {
      removeSessionListener();
      removeMilestoneListener();
      window.removeEventListener('valis-data-update', handleUpdate);
    };
  }, [refresh, user]);

  return null;
};
