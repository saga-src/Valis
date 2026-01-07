
import { useEffect, useCallback } from 'react';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';
import { supabase } from '../../../lib/cloud/supabase';

export const useAchievements = () => {
  const { broadcastAchievement } = useSocialBroadcast();

  /**
   * Core logic to handle rewards, stats, and platinum checks for a set of unlocked achievements.
   * Used by both manual toggles and the automatic watcher.
   */
  const processUnlocks = useCallback(async (gameId: string, unlockedIds: string[]) => {
    if (unlockedIds.length === 0) return;

    let xpReward = 0;
    let achievementDelta = 0;
    let platinumDelta = 0;

    // 1. Calculate Base Reward (10 XP per achievement)
    achievementDelta = unlockedIds.length;
    xpReward += (achievementDelta * 10);

    // 2. Check for Platinum (100% Completion)
    try {
        if (window.api && window.api.getGameAchievements) {
            const all = await window.api.getGameAchievements(gameId);
            const totalCount = all.length;
            
            // Check unlocked count (Database state should already be updated by Watcher or Toggle)
            const unlockedCount = all.filter((a: any) => a.unlockedAt || a.defaultUnlocked).length;

            if (totalCount > 0 && unlockedCount === totalCount) {
                // Determine if we *just* hit platinum. 
                // If the batch size equals the total unlocked, we definitely just hit it.
                // Otherwise, we might be re-triggering if we aren't careful, but standard logic assumes
                // we only process *new* unlocks here.
                console.log(`[Achievements] 🏆 Platinum Unlocked for Game ${gameId}`);
                
                platinumDelta = 1;
                xpReward += 1000; // Bonus for Platinum

                // Broadcast Platinum Leaderboard Update
                supabase.rpc('update_leaderboard', {
                    p_category: 'platinum',
                    p_sub_category: 'global',
                    p_increment: 1
                }).then(({ error }) => {
                    if (error) console.error('[Leaderboard] Platinum Error:', error);
                });
            }
        }
    } catch (e) {
        console.error('[useAchievements] Completion check failed:', e);
    }

    // 3. Local Fallback: Update Local XP
    if (window.api && window.api.addPlaytimeXP && xpReward > 0) {
        window.api.addPlaytimeXP(xpReward).catch(err => console.error("Local XP update failed:", err));
    }

    // 4. Cloud Broadcast: Update Stats & Leaderboards
    try {
        // A. Achievement Count Leaderboard
        if (achievementDelta > 0) {
            supabase.rpc('update_leaderboard', {
                p_category: 'achievements',
                p_sub_category: 'global',
                p_increment: achievementDelta
            }).then(({ error }) => {
                if (error) console.error('[Leaderboard] Achievement Error:', error);
            });
        }

        // B. Player Stats (XP + Counts)
        const statsPayload: any = {
            achievements: achievementDelta,
            xp: xpReward
        };
        
        if (platinumDelta > 0) {
            statsPayload.platinum = platinumDelta;
        }

        supabase.rpc('update_player_stats', statsPayload).then(({ error }) => {
            if (error) console.error('[Leaderboard] Stats Update Failed:', error);
        });

    } catch (e) {
        console.error('[useAchievements] Broadcast failed:', e);
    }
  }, []);

  // Manual Toggle function (exposed for UI)
  const toggleAchievement = useCallback(async (gameId: string, achievementId: string, isUnlocked: boolean) => {
    if (isUnlocked) {
        // Manually unlock in DB (Optimistic / UI driven)
        // Note: The watcher handles file-based unlocks automatically. 
        // This is for manual overrides or non-file based systems.
        // We assume the DB update happens elsewhere or is implied, 
        // but to be safe we trigger the process logic.
        await processUnlocks(gameId, [achievementId]);
    }
  }, [processUnlocks]);

  // Automatic Listener (Watcher)
  useEffect(() => {
    if (!window.api || !window.api.onAchievementUnlocked) return;

    const unsubscribe = window.api.onAchievementUnlocked(async (data: any) => {
        try {
             const gameId = data.gameId;
             const newIds = data.newUnlocks.map((u: any) => u.id);

             // 1. Social Broadcasts (Individual)
             // We fetch details to make the social feed look nice
             try {
                const game = await window.api.getGameById(gameId);
                const gameTitle = game?.title || game?.name || 'Unknown Game';
                const allAchievements = await window.api.getGameAchievements(gameId);

                for (const unlock of data.newUnlocks) {
                     const def = allAchievements.find((a: any) => a.id === unlock.id);
                     const name = def ? def.name : unlock.id;
                     const icon = def ? def.iconUrl : undefined;
                     
                     // Broadcast individually to social feed
                     await broadcastAchievement(gameTitle, name, icon, game?.cover_url);
                }
             } catch (e) {
                console.warn('[useAchievements] Social broadcast warning', e);
             }

             // 2. Process Rewards & Stats (Batch)
             await processUnlocks(gameId, newIds);

        } catch (e) {
            console.error('[useAchievements] Error processing unlock event:', e);
        }
    });

    return () => unsubscribe();
  }, [broadcastAchievement, processUnlocks]);

  return { toggleAchievement };
};
