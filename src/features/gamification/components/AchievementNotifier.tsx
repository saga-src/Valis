
import React, { useEffect, useState } from 'react';
import { AchievementShard, ShardItem } from './AchievementShard';

// Import audio assets for Vite bundling
import achievementSound from '../../../../public/sounds/achievements.mp3';
import milestoneSound from '../../../../public/sounds/milestone_unlock.mp3';
import protocolSound from '../../../../public/sounds/protocol_unlock.mp3';

export const AchievementNotifier = () => {
  const [queue, setQueue] = useState<ShardItem[]>([]);
  const [current, setCurrent] = useState<ShardItem | null>(null);

  // Helper to process notifications based on settings
  const handleNotification = async (
    item: ShardItem, 
    resolvedSoundUrl: string, 
    settingsPrefix: 'protocol' | 'achievement' | 'milestone'
  ) => {
    try {
        const [toastEnabled, soundEnabled] = await Promise.all([
            window.api.getSetting(`${settingsPrefix}_toast`),
            window.api.getSetting(`${settingsPrefix}_sound`)
        ]);

        // Default to true if setting is null (first run)
        const showToast = toastEnabled !== false;
        const playSound = soundEnabled !== false;

        if (showToast) {
            // Case 1 & 2: Toast is ON.
            // Add to queue. Pass soundUrl ONLY if sound is also ON.
            // The Shard component will play the sound when it renders.
            setQueue((prev) => [...prev, {
                ...item,
                soundUrl: playSound ? resolvedSoundUrl : undefined
            }]);
        } else if (playSound) {
            // Case 3: Toast is OFF, but Sound is ON.
            // Play sound immediately since no visual component will mount to trigger it.
            try {
                const audio = new Audio(resolvedSoundUrl);
                audio.volume = 0.5;
                audio.play().catch(e => console.warn('Audio playback prevented:', e));
            } catch (e) {
                console.warn('Audio error:', e);
            }
        }
    } catch (e) {
        console.error('Notification Error:', e);
    }
  };

  // Process Queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0];
      setCurrent(next);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  // 1. Protocol Unlocks (Unique Artifacts)
  useEffect(() => {
    const handleUnlock = (event: any) => { 
      const mark = event.detail; 
      handleNotification(
        {
            id: mark.id,
            name: mark.title,
            lore: mark.lore,
            visual: mark.visual,
            iconName: mark.iconName,
            type: 'protocol'
        },
        protocolSound,
        'protocol'
      );
    };

    window.addEventListener('unlock_protocol', handleUnlock);
    return () => window.removeEventListener('unlock_protocol', handleUnlock);
  }, []);

  // 2. Achievement Unlocks (Game)
  useEffect(() => {
    if (!window.api || !window.api.onAchievementUnlocked) return;

    const unsubscribe = window.api.onAchievementUnlocked(async (data: any) => {
        // Fetch details to get name/icon for the notification
        const allAchievements = await window.api.getGameAchievements(data.gameId);
        
        for (const unlock of data.newUnlocks) {
            const details = allAchievements.find((a: any) => a.id === unlock.id);
            const name = details ? details.name : 'Achievement Unlocked';
            
            await handleNotification(
                {
                    id: unlock.id,
                    name: name,
                    iconUrl: details ? details.iconUrl : undefined,
                    type: 'default'
                },
                achievementSound,
                'achievement'
            );
        }
    });

    return () => unsubscribe();
  }, []);

  // 3. Milestones (Gamification)
  useEffect(() => {
    if (!window.api || !window.api.onMilestoneUnlocked) return;
    
    const unsubscribe = window.api.onMilestoneUnlocked((data: any) => {
        handleNotification(
            {
                id: `milestone-${Date.now()}`,
                name: data.title,
                subtitle: data.archetype,
                type: 'milestone',
                iconName: data.iconName
            },
            milestoneSound,
            'milestone'
        );
    });
    return () => unsubscribe();
  }, []);

  // 4. Manual Milestone Test (Settings Page)
  useEffect(() => {
    const handleTest = (e: any) => {
        const data = e.detail;
        handleNotification(
            {
                id: `test-milestone-${Date.now()}`,
                name: data.title || "System Check",
                subtitle: data.archetype || "Diagnostics",
                type: 'milestone',
                iconName: 'Activity'
            },
            milestoneSound,
            'milestone'
        );
    };

    window.addEventListener('TEST_MILESTONE_TOAST', handleTest);
    return () => window.removeEventListener('TEST_MILESTONE_TOAST', handleTest);
  }, []);

  if (!current) return null;

  return (
    <AchievementShard 
      item={current} 
      onComplete={() => setCurrent(null)} 
    />
  );
};
