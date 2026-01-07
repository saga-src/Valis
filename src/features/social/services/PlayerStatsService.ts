
import { supabase } from '../../../lib/cloud/supabase';

export interface BeatenGamePayload {
  id: string;
  title: string;
  cover: string;
  score: number;
}

export interface CompletedGamePayload {
  id: string;
  title: string;
  cover: string;
  achievements: string; // e.g. "50/50"
}

export interface MilestonePayload {
  key: string;
  label: string;
  rank: number;
  archetype?: string; // Added optional archetype ID for metadata
}

export interface ObsessionPayload {
  game_id: string;
  title: string;
  cover: string;
  hours_last_30_days: number;
  last_played: string;
  platforms?: any[];
}

export const PlayerStatsService = {
  /**
   * Increment the total games owned count.
   */
  async incrementGamesOwned(userId: string) {
    try {
      // 1. Fetch current count
      const { data, error } = await supabase
        .from('player_stats')
        .select('games_owned')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // 2. Increment and save
      const newCount = (data?.games_owned || 0) + 1;
      
      const { error: updateError } = await supabase
        .from('player_stats')
        .update({ games_owned: newCount })
        .eq('user_id', userId);

      if (updateError) throw updateError;
      
      return true;
    } catch (e) {
      console.error('[PlayerStatsService] incrementGamesOwned failed:', e);
      return false;
    }
  },

  /**
   * Sync a beaten game to the JSONB list and increment games_beaten count.
   * Handles upsert logic within the JSON array.
   */
  async syncBeatenGame(userId: string, game: BeatenGamePayload) {
    try {
      // 1. Fetch current stats
      const { data, error } = await supabase
        .from('player_stats')
        .select('beaten_games, games_beaten')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      let list = (data?.beaten_games || []) as BeatenGamePayload[];
      const existingIndex = list.findIndex(g => g.id === game.id);
      
      let beatCountDelta = 0;

      if (existingIndex >= 0) {
        // Update existing entry
        list[existingIndex] = game;
      } else {
        // Add new entry
        list.push(game);
        beatCountDelta = 1;
      }

      // 2. Update DB
      const updatePayload: any = { beaten_games: list };
      if (beatCountDelta > 0) {
        updatePayload.games_beaten = (data?.games_beaten || 0) + beatCountDelta;
      }

      const { error: updateError } = await supabase
        .from('player_stats')
        .update(updatePayload)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return true;
    } catch (e) {
      console.error('[PlayerStatsService] syncBeatenGame failed:', e);
      return false;
    }
  },

  /**
   * Sync a completed (100%) game to the JSONB list and increment total_platinum count.
   */
  async syncCompletedGame(userId: string, game: CompletedGamePayload) {
    try {
      // 1. Fetch current stats
      const { data, error } = await supabase
        .from('player_stats')
        .select('completed_games, total_platinum')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      let list = (data?.completed_games || []) as CompletedGamePayload[];
      const existingIndex = list.findIndex(g => g.id === game.id);
      
      let platCountDelta = 0;

      if (existingIndex >= 0) {
        list[existingIndex] = game;
      } else {
        list.push(game);
        platCountDelta = 1;
      }

      // 2. Update DB
      const updatePayload: any = { completed_games: list };
      if (platCountDelta > 0) {
        updatePayload.total_platinum = (data?.total_platinum || 0) + platCountDelta;
      }

      const { error: updateError } = await supabase
        .from('player_stats')
        .update(updatePayload)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return true;
    } catch (e) {
      console.error('[PlayerStatsService] syncCompletedGame failed:', e);
      return false;
    }
  },

  /**
   * Unlock a protocol artifact if not already present.
   */
  async unlockArtifact(userId: string, artifactId: string) {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('unlocked_artifacts')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const artifacts = (data?.unlocked_artifacts || []) as string[];

      if (!artifacts.includes(artifactId)) {
        artifacts.push(artifactId);
        
        const { error: updateError } = await supabase
          .from('player_stats')
          .update({ unlocked_artifacts: artifacts })
          .eq('user_id', userId);

        if (updateError) throw updateError;
        return true;
      }

      return false; // Already unlocked
    } catch (e) {
      console.error('[PlayerStatsService] unlockArtifact failed:', e);
      return false;
    }
  },

  /**
   * Update progress for a specific milestone.
   */
  async updateMilestone(userId: string, milestone: MilestonePayload) {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('milestones_progress')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const progress = (data?.milestones_progress || {}) as Record<string, any>;
      
      // Update or Set the specific key
      progress[milestone.key] = {
        label: milestone.label,
        rank: milestone.rank,
        archetype: milestone.archetype,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('player_stats')
        .update({ milestones_progress: progress })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return true;
    } catch (e) {
      console.error('[PlayerStatsService] updateMilestone failed:', e);
      return false;
    }
  },

  /**
   * Updates the user's current obsession (most played recently).
   */
  async updateObsession(userId: string, data: ObsessionPayload) {
    try {
      const { error } = await supabase
        .from('player_stats')
        .update({ current_obsession: data })
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (e) {
      console.error('[PlayerStatsService] updateObsession failed:', e);
      return false;
    }
  }
};
