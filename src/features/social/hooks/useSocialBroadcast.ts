
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';

export const useSocialBroadcast = () => {
  const { user } = useAuth();

  const broadcast = async (type: string, payload: any) => {
    if (!user) return;

    try {
      // Ensure payload is a plain JSON object
      const cleanPayload = JSON.parse(JSON.stringify(payload));
      
      const activityData = {
        user_id: user.id,
        type: type,
        data: cleanPayload,
        created_at: new Date().toISOString()
      };

      console.log(`[Broadcast] Transmitting ${type}:`, activityData);

      const { error } = await supabase.from('activities').insert(activityData);
      if (error) console.error("Broadcast Failed:", error);
    } catch (err) {
      console.error("Broadcast Exception:", err);
    }
  };

  return {
    broadcast,

    broadcastSession: async (game: string, duration: number, xp: number, platform: string, cover_url?: string) => 
      await broadcast('session', { game_title: game, cover_url, duration, xp, platform }),

    broadcastSync: async (platform: string, gameCount: number, achievementCount: number) => 
      await broadcast('sync', { platform, count: gameCount, achievements: achievementCount }),

    broadcastImport: async (platform: string, count: number, hours: number) =>
      await broadcast('import', { platform, count, hours }),

    broadcastGameAdded: async (game: string, platform: string, price: number, cover_url?: string) => 
      await broadcast('added', { game_title: game, cover_url, platform, price }),

    broadcastStatusChange: async (game: string, oldStatus: string, newStatus: string, cover_url?: string) => 
      await broadcast('status', { game_title: game, cover_url, old_status: oldStatus, new_status: newStatus }),

    broadcastAchievement: async (game: string, achievement: string, icon?: string, cover_url?: string) =>
      await broadcast('achievement', { game_title: game, achievement, icon, cover_url }),

    broadcastReview: async (game: string, rating: number, text: string, cover_url?: string) =>
      await broadcast('review', { game_title: game, rating, text, cover_url }),

    broadcastMilestone: async (milestone: { title: string; rank: number; archetype: string; icon: string; discipline: string; maxRanks: number }) => 
      await broadcast('milestone', { 
        title: milestone.title, 
        level: milestone.rank, 
        discipline: milestone.discipline,
        archetype: milestone.archetype, 
        icon: milestone.icon,
        maxRanks: milestone.maxRanks
      }),

    broadcastProtocol: async (artifact: { title: string; lore: string; visual: string; iconName: string }) => 
      await broadcast('protocol', { 
        name: artifact.title, 
        description: artifact.lore, 
        visual: artifact.visual, 
        icon: artifact.iconName 
      })
  };
};
