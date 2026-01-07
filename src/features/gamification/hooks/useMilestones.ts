
import { useEffect } from 'react';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';

export const useMilestones = () => {
  const { broadcastStatus } = useSocialBroadcast();

  // 1. Milestones (Level Ups / Tier Unlocks via IPC)
  useEffect(() => {
    if (!window.api || !window.api.onMilestoneUnlocked) return;

    const unsubscribe = window.api.onMilestoneUnlocked((data: any) => {
       // data: { title, archetype, level, xp, maxRanks, iconName }
       const statusText = `Reached Rank ${data.level}: ${data.title}`;
       // We use 'Valis Protocol' as the "Game Name" context for these system events
       broadcastStatus('Valis Protocol', statusText, data.level);
    });

    return () => unsubscribe();
  }, [broadcastStatus]);

  // 2. Protocols (Unique Artifacts via Window Event)
  useEffect(() => {
    const handleProtocol = (event: any) => {
        const mark = event.detail;
        // mark: { id, title, lore, visual, iconName ... }
        const statusText = `Unlocked Protocol: ${mark.title}`;
        // We use 'System Core' as the "Game Name" context for these secret events
        broadcastStatus('System Core', statusText);
    };

    window.addEventListener('unlock_protocol', handleProtocol);
    return () => window.removeEventListener('unlock_protocol', handleProtocol);
  }, [broadcastStatus]);
};
