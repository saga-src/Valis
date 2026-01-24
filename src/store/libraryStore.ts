import { create } from 'zustand';

export interface TagFilters {
  include: number[];
  exclude: number[];
}

interface LibraryState {
  games: any[];
  tags: any[];
  lastFetch: number;
  isCached: boolean;
  tagFilters: TagFilters;
  setLibrary: (games: any[]) => void;
  setTags: (tags: any[]) => void;
  invalidateCache: () => void;
  setTagFilters: (filters: TagFilters) => void;
  toggleTagFilter: (tagId: number) => void;
  clearTagFilters: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  games: [],
  tags: [],
  lastFetch: 0,
  isCached: false,
  tagFilters: { include: [], exclude: [] },

  setLibrary: (games) => {
    console.log('[Store] Updating Cache with', games.length, 'games');
    set({ 
      games, 
      isCached: true, 
      lastFetch: Date.now() 
    });
  },

  setTags: (tags) => set({ tags }),

  invalidateCache: () => {
    console.log('[Store] Cache Invalidated');
    set({ isCached: false });
  },

  setTagFilters: (tagFilters) => set({ tagFilters }),

  toggleTagFilter: (tagId) => set((state) => {
    const { include, exclude } = state.tagFilters;
    
    // Tri-State Logic: Neutral -> Include -> Exclude -> Neutral
    if (!include.includes(tagId) && !exclude.includes(tagId)) {
      // Move to Include
      return { tagFilters: { ...state.tagFilters, include: [...include, tagId] } };
    } else if (include.includes(tagId)) {
      // Move to Exclude
      return { 
        tagFilters: { 
          include: include.filter(id => id !== tagId),
          exclude: [...exclude, tagId]
        } 
      };
    } else {
      // Move to Neutral (Remove from both)
      return { 
        tagFilters: { 
          ...state.tagFilters,
          exclude: exclude.filter(id => id !== tagId)
        } 
      };
    }
  }),

  clearTagFilters: () => set({ tagFilters: { include: [], exclude: [] } })
}));