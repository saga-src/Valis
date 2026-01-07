
import { create } from 'zustand';

interface SyncState {
  isSyncing: boolean;
  message: string;
  progress: number; // 0 to 100
  setSyncing: (isSyncing: boolean) => void;
  updateProgress: (message: string, current: number, total: number) => void;
  reset: () => void;
  runSync: (syncPromise: Promise<any>) => Promise<any>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  message: '',
  progress: 0,
  
  setSyncing: (isSyncing) => set({ isSyncing }),
  
  updateProgress: (message, current, total) => {
    const percent = total > 0 ? (current / total) * 100 : 0;
    set({ message, progress: percent });
  },

  reset: () => set({ isSyncing: false, message: '', progress: 0 }),

  // Helper to wrap API calls and ensure state cleanup
  runSync: async (syncPromise) => {
    set({ isSyncing: true, progress: 0, message: 'Starting...' });
    try {
        const result = await syncPromise;
        return result;
    } finally {
        // Delay closing slightly so user sees 100%
        setTimeout(() => {
            set({ isSyncing: false, message: '', progress: 0 });
        }, 2000);
    }
  }
}));
