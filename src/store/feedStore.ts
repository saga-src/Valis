import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeedItem {
  id: string;
  type: string;
  created_at: string;
  user_id: string;
  game_id?: string;
  data: any; 
  profile?: {
    username: string;
    avatar_url: string;
  };
}

interface FeedState {
  items: FeedItem[];
  lastFetched: number | null;
  setFeed: (items: FeedItem[]) => void;
  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      items: [],
      lastFetched: null,
      setFeed: (items) => set({ items, lastFetched: Date.now() }),
      clearFeed: () => set({ items: [], lastFetched: null }),
    }),
    {
      name: 'valis-feed-cache', // Key in localStorage
    }
  )
);
