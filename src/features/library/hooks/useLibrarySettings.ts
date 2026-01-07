import { useState, useEffect } from 'react';

export type ViewMode = 'grid' | 'list' | 'data';
export type SortOption = 'lastPlayed' | 'alphabetical' | 'timePlayed' | 'rating' | 'releaseDate' | 'added' | 'name' | 'score' | 'time' | 'release';

export interface LibrarySettings {
  viewMode: ViewMode;
  sortBy: SortOption;
  showTime: boolean;
  showSessions: boolean;
  showRating: boolean;
  showDlc: boolean; // ⚡ Added
  sortDirection: 'asc' | 'desc';
}

const DEFAULT_SETTINGS: LibrarySettings = {
  viewMode: 'grid',
  sortBy: 'added',
  showTime: true,
  showSessions: false,
  showRating: true,
  showDlc: false, // ⚡ Added default
  sortDirection: 'desc'
};

export const useLibrarySettings = () => {
  const [settings, setSettingsState] = useState<LibrarySettings>(() => {
    const saved = localStorage.getItem('library_view_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<LibrarySettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('library_view_settings', JSON.stringify(updated));
      return updated;
    });
  };

  return { settings, updateSettings };
};