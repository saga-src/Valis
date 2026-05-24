
import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    setLoading(true);
    fetchLocalProfile();
  }, [fetchLocalProfile]);

  useEffect(() => {
    const refreshOnLocalChange = (event: Event) => {
      const type = (event as CustomEvent)?.detail?.type;
      if (!type || ['library', 'game', 'achievement', 'restore', 'reset'].includes(type)) {
        void fetchLocalProfile();
      }
    };

    window.addEventListener('valis-data-update', refreshOnLocalChange);
    window.addEventListener('valis-profile-data-refresh', refreshOnLocalChange);
    return () => {
      window.removeEventListener('valis-data-update', refreshOnLocalChange);
      window.removeEventListener('valis-profile-data-refresh', refreshOnLocalChange);
    };
  }, [fetchLocalProfile]);

  return { profile, loading, error, refresh: fetchLocalProfile };
};
