import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';

// Define the shape of the unified profile data
export interface ProfileViewModel {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  playstyle?: string;
  
  // Stats from player_stats table (Direct Mapping)
  level: number;
  current_xp: number;
  next_level_xp: number;
  
  games_owned: number;
  games_beaten: number;
  total_platinum: number;
  total_playtime: number;

  // Rich Data (JSONB columns)
  artifacts: string[]; // Map from unlocked_artifacts
  milestones: Record<string, any>; // Map from milestones_progress
  perfect_games: Array<{ title: string; cover: string; achievements: string }>; // Map from completed_games
  beaten_games_list: Array<{ title: string; cover: string; score: number }>; // Map from beaten_games
  
  // New: Current Obsession
  current_obsession?: {
    title: string;
    cover: string;
    hours: number;
    last_played: string;
    platforms: any[];
  } | null;
}

export const useProfileData = (targetUserId?: string) => {
  const { user } = useAuth();
  const [data, setData] = useState<ProfileViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine which ID to fetch: passed arg -> current user -> null
  const userId = targetUserId || user?.id;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch Profile Identity
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error("Profile not found");

      // Fetch Player Stats
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (statsError) throw statsError;

      // Default stats if user hasn't synced yet
      const stats = statsData || {
          current_level: 1,
          current_xp: 0,
          next_level_xp: 100,
          games_owned: 0,
          games_beaten: 0,
          total_platinum: 0,
          total_playtime: 0,
          milestones_progress: {},
          unlocked_artifacts: [],
          beaten_games: [],
          completed_games: [],
          current_obsession: null
      };

      // Construct Unified View Model using DB columns
      const viewModel: ProfileViewModel = {
          id: profileData.id,
          username: profileData.username,
          display_name: profileData.display_name || profileData.username,
          avatar_url: profileData.avatar_url,
          bio: profileData.bio,
          playstyle: profileData.playstyle || 'Novice',
          
          // Leveling
          level: stats.current_level || 1,
          current_xp: stats.current_xp || 0,
          next_level_xp: stats.next_level_xp || 100,
          
          // Counts
          games_owned: stats.games_owned || 0,
          games_beaten: stats.games_beaten || 0,
          total_platinum: stats.total_platinum || 0,
          total_playtime: stats.total_playtime || 0,

          // JSONB Structures
          artifacts: stats.unlocked_artifacts || [],
          milestones: stats.milestones_progress || {},
          perfect_games: stats.completed_games || [],
          beaten_games_list: stats.beaten_games || [],
          
          // Current Obsession
          current_obsession: stats.current_obsession ? {
              title: stats.current_obsession.title,
              cover: stats.current_obsession.cover,
              hours: stats.current_obsession.hours_last_30_days,
              last_played: stats.current_obsession.last_played,
              platforms: stats.current_obsession.platforms || []
          } : null
      };

      setData(viewModel);

    } catch (err: any) {
      console.error('[useProfileData] Fetch failed:', err);
      setError(err.message || 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};