import { create } from 'zustand';

interface LibraryState {
  games: any[];
  lastFetch: number;
  isCached: boolean;
  setLibrary: (games: any[]) => void;
  invalidateCache: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  games: [],
  lastFetch: 0,
  isCached: false,
  setLibrary: (games) => {
    console.log('[Store] Updating Cache with', games.length, 'games');
    set({ 
      games, 
      isCached: true, 
      lastFetch: Date.now() 
    });
  },
  invalidateCache: () => {
    console.log('[Store] Cache Invalidated');
    set({ isCached: false });
  }
}));
