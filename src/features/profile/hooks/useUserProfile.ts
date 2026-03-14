
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/cloud/supabase';
import { getTotalPlaytimeSeconds } from '../../../lib/utils/format';

// --- Types ---

export interface MilestoneItem {
  id: string;
  title: string;
  icon: string;
  rank: number;
  unlocked_at: string;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  cover_url: string;
  rating?: number;
}

export interface UserProfile {
  identity: {
    username: string;
    avatar_url: string;
    title: string;
  };
  leveling: {
    level: number;
    current_xp: number;
    next_level_xp: number;
    xp_progress_percent: number;
  };
  stats: {
    total_playtime: number; // in seconds
    games_owned: number;
    games_beaten: number;
    total_platinum: number;
  };
  wallet: MilestoneItem[];
  showcase: ShowcaseItem[];
  preferences: {
    pinned_badges: string[];
    pinned_artifacts: string[];
  };
}

const DEFAULT_PROFILE: UserProfile = {
  identity: { username: 'Guest', avatar_url: '', title: 'Novice Explorer' },
  leveling: { level: 1, current_xp: 0, next_level_xp: 100, xp_progress_percent: 0 },
  stats: { total_playtime: 0, games_owned: 0, games_beaten: 0, total_platinum: 0 },
  wallet: [],
  showcase: [],
  preferences: { pinned_badges: [], pinned_artifacts: [] }
};

// --- XP Formula Helpers ---
// Formula: Level = floor(0.1 * sqrt(XP))
// Inverse (XP needed for Level L): XP = (L / 0.1)^2 = (10L)^2 = 100 * L^2
const calculateLevelFromXP = (xp: number) => Math.floor(0.1 * Math.sqrt(xp)) || 1;
const calculateXPForLevel = (level: number) => 100 * Math.pow(level, 2);

export const useUserProfile = () => {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocalProfile = useCallback(async () => {
    try {
      if (!window.api) throw new Error("API not available");

      // 1. Fetch Local Data
      const library = await window.api.getLibrary();
      const settings = await window.api.getSetting('user_profile'); // saved in local settings.js

      // 2. Calculate Stats
      let totalPlaytime = 0;
      let gamesBeaten = 0;
      let totalPlatinum = 0;
      const showcase: ShowcaseItem[] = [];

      library.forEach(game => {
        // Stats
        totalPlaytime += getTotalPlaytimeSeconds(game);
        
        if (game.status === 'Beat' || game.status === 'Completed') {
          gamesBeaten++;
        }

        if (game.status === 'Completed') {
          totalPlatinum++;
          // Add to showcase (max 5)
          if (showcase.length < 5) {
            showcase.push({
              id: game.id,
              title: game.title || game.name,
              cover_url: game.cover_url || '',
              rating: game.final_score
            });
          }
        }
      });

      // 3. Calculate XP & Level
      // 10 XP per Hour + 250 XP per Beat + 1000 XP per Platinum
      const hoursPlayed = totalPlaytime / 3600;
      const calculatedXP = Math.floor(
        (hoursPlayed * 10) + 
        (gamesBeaten * 250) + 
        (totalPlatinum * 1000)
      );

      const currentLevel = calculateLevelFromXP(calculatedXP);
      const nextLevelXP = calculateXPForLevel(currentLevel + 1);
      const prevLevelXP = calculateXPForLevel(currentLevel);
      
      const progress = Math.min(100, Math.max(0, 
        ((calculatedXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100
      ));

      // 4. Construct Profile
      setProfile({
        identity: {
          username: settings?.username || 'Guest',
          avatar_url: settings?.avatarUrl || '',
          title: settings?.title || 'Local Explorer'
        },
        leveling: {
          level: currentLevel,
          current_xp: calculatedXP,
          next_level_xp: nextLevelXP,
          xp_progress_percent: progress
        },
        stats: {
          total_playtime: totalPlaytime,
          games_owned: library.length,
          games_beaten: gamesBeaten,
          total_platinum: totalPlatinum
        },
        wallet: [], // Milestone wallet logic is complex for local, keeping empty for MVP
        showcase,
        preferences: {
          pinned_badges: settings?.pinned_badges || [],
          pinned_artifacts: settings?.pinned_artifacts || []
        }
      });

    } catch (err: any) {
      console.error("Local profile load failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCloudProfile = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch Stats (Safely using maybeSingle to avoid 406 on missing row)
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (statsError) {
        console.warn('Error fetching player stats:', statsError);
      }

      // Default stats for new users
      const stats = statsData || {
        total_xp: 0,
        total_playtime_seconds: 0,
        games_owned: 0,
        games_beaten: 0,
        games_completed: 0
      };

      // 2. Fetch Milestone Wallet (RPC)
      const { data: walletData, error: walletError } = await supabase
        .rpc('get_milestone_wallet', { user_id: user.id });

      if (walletError) {
        console.warn("Wallet fetch error:", walletError);
      }

      // 3. Fetch Showcase (Placeholder for now)
      const showcaseData: ShowcaseItem[] = []; 

      // 4. Process Leveling
      const xp = stats.total_xp || 0;
      const currentLevel = calculateLevelFromXP(xp);
      const nextLevelXP = calculateXPForLevel(currentLevel + 1);
      const prevLevelXP = calculateXPForLevel(currentLevel);
      
      const progress = nextLevelXP > prevLevelXP
        ? Math.min(100, Math.max(0, ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100))
        : 0;

      setProfile({
        identity: {
          username: authProfile?.username || user.email?.split('@')[0] || 'Gamer',
          avatar_url: authProfile?.avatar_url || '',
          title: authProfile?.playstyle || 'Novice'
        },
        leveling: {
          level: currentLevel,
          current_xp: xp,
          next_level_xp: nextLevelXP,
          xp_progress_percent: progress
        },
        stats: {
          total_playtime: stats.total_playtime_seconds || 0,
          games_owned: stats.games_owned || 0,
          games_beaten: stats.games_beaten || 0,
          total_platinum: stats.games_completed || 0
        },
        wallet: walletData || [],
        showcase: showcaseData,
        preferences: {
          pinned_badges: stats.pinned_badges || [],
          pinned_artifacts: stats.pinned_artifacts || []
        }
      });

    } catch (err: any) {
      console.error("Cloud profile load failed:", err);
      setError(err.message);
      // Fallback to local if cloud fails
      fetchLocalProfile();
    } finally {
      setLoading(false);
    }
  }, [user, authProfile, fetchLocalProfile]);

  useEffect(() => {
    setLoading(true);
    if (user) {
      fetchCloudProfile();
    } else {
      fetchLocalProfile();
    }
  }, [user, fetchCloudProfile, fetchLocalProfile]);

  return { profile, loading, error, refresh: user ? fetchCloudProfile : fetchLocalProfile };
};
