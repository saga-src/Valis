
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';

export const useSocialBroadcast = () => {
  const { user } = useAuth();

  const broadcast = async (type: 'session' | 'achievement' | 'status' | 'review' | 'import', payload: any) => {
    if (!user) return;

    try {
      // FIX: Ensure 'payload' (which contains cover_url) is assigned to the 'data' column
      // We do not map game_title or game_cover_url to top-level columns as they likely don't exist in the schema
      const activityData = {
        user_id: user.id,
        type: type,
        data: payload, // <--- Correct: JSON data goes here
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('activities').insert(activityData);

      if (error) {
        console.error("Broadcast Failed:", error);
      }
    } catch (err) {
      console.error("Broadcast Exception:", err);
    }
  };

  // Helper: Broadcast Session
  const broadcastSession = async (gameTitle: string, durationSeconds: number, coverUrl?: string) => {
    await broadcast('session', {
      game: gameTitle,
      duration: durationSeconds,
      cover_url: coverUrl // This will now go safely into 'data'
    });
  };

  // Helper: Broadcast Achievement
  const broadcastAchievement = async (gameTitle: string, achievementName: string, iconUrl?: string, coverUrl?: string) => {
    await broadcast('achievement', {
      game: gameTitle,
      achievement: achievementName,
      icon_url: iconUrl,
      cover_url: coverUrl,
      detail: `Unlocked: ${achievementName}`
    });
  };

  // Helper: Broadcast Review
  const broadcastReview = async (gameTitle: string, rating: number, text: string, coverUrl?: string) => {
    await broadcast('review', {
      game: gameTitle,
      rating,
      text,
      cover_url: coverUrl
    });
  };

  // Helper: Broadcast Status Update
  const broadcastStatus = async (gameTitle: string, status: string, score?: number, coverUrl?: string) => {
    await broadcast('status', {
        game: gameTitle,
        status,
        score,
        cover_url: coverUrl
    });
  };

  // Helper: Broadcast Import
  const broadcastImport = async (source: string, count: number, totalPlaytimeHours?: number) => {
    await broadcast('import', {
      source,
      count,
      playtime: totalPlaytimeHours
    });
  };

  return { broadcast, broadcastSession, broadcastAchievement, broadcastReview, broadcastStatus, broadcastImport };
};
