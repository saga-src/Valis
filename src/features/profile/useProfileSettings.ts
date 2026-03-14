import { useState } from 'react';

export interface ProfileSettings {
  username: string;
  displayName: string;
  bio: string;
  title: string; // e.g. "Backlog Conqueror"
  avatarUrl: string;
  highlightBadgeId: string | null;
  favorites: (string | null)[];
  obsessions: (string | null)[];
  pinned_badges: string[];
  pinned_artifacts: string[];
}

const DEFAULT_PROFILE: ProfileSettings = {
  username: "Player One",
  displayName: "Player One",
  bio: "",
  title: "Novice Gamer",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  highlightBadgeId: null,
  favorites: [null, null, null, null, null],
  obsessions: [null, null, null, null, null],
  pinned_badges: [],
  pinned_artifacts: []
};

export const useProfileSettings = () => {
  const [settings, setSettingsState] = useState<ProfileSettings>(() => {
    try {
      const saved = localStorage.getItem('user_profile');
      // Merge with default to ensure all fields exist even if local storage is partial/old
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch (e) {
      console.error("Failed to load profile settings", e);
      return DEFAULT_PROFILE;
    }
  });

  const updateProfile = (newSettings: Partial<ProfileSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('user_profile', JSON.stringify(updated));
      return updated;
    });
  };

  return { settings, updateProfile };
};