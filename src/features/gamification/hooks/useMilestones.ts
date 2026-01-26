
import { useEffect } from 'react';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';

export const useMilestones = () => {
  const { broadcastMilestone, broadcastProtocol } = useSocialBroadcast();

  // 1. Milestones (Level Ups / Tier Unlocks via IPC)
  useEffect(() => {
    if (!window.api || !window.api.onMilestoneUnlocked) return;

    const unsubscribe = window.api.onMilestoneUnlocked((data: any) => {
       // data: { title, archetype, discipline, level, xp, maxRanks, iconName }
       broadcastMilestone({
         title: data.title,
         rank: data.level,
         discipline: data.discipline,
         archetype: data.archetype,
         icon: data.iconName,
         maxRanks: data.maxRanks
       });
    });

    return () => unsubscribe();
  }, [broadcastMilestone]);

  // 2. Protocols (Unique Artifacts via Window Event)
  useEffect(() => {
    const handleProtocol = (event: any) => {
        const mark = event.detail;
        // mark: { id, title, lore, visual, iconName ... }
        broadcastProtocol({
          title: mark.title,
          lore: mark.lore,
          visual: mark.visual,
          iconName: mark.iconName
        });
    };

    window.addEventListener('unlock_protocol', handleProtocol);
    return () => window.removeEventListener('unlock_protocol', handleProtocol);
  }, [broadcastProtocol]);
};
