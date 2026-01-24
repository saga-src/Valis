import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DraftSession {
  mood: string;
  notes: string[];
  journal: string;
  platformId?: number;
}

interface SessionState {
  activeSession: {
    gameId: string;
    startTime: number;
    gameTitle: string;
    coverUrl?: string;
    platformId?: number;
    sessionId?: string; // New field to track DB ID
  } | null;
  lastUpdate: number; // Timestamp to trigger re-renders/refetches in components
  startTimer: (gameId: string, gameTitle: string, coverUrl?: string, platformId?: number, startTime?: number, existingSessionId?: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  cancelTimer: () => void;

  // Draft State (Persists across navigation)
  draft: DraftSession;
  setDraftMood: (mood: string) => void;
  setDraftPlatform: (id: number) => void;
  addDraftNote: (note: string) => void;
  removeDraftNote: (note: string) => void;
  setDraftJournal: (text: string) => void;
  clearDraft: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      lastUpdate: Date.now(),
      draft: { mood: '😶', notes: [], journal: '', platformId: 0 },

      startTimer: async (gameId, gameTitle, coverUrl, platformId, startTime, existingSessionId) => {
        const start = startTime ?? Date.now();
        let sessionId = existingSessionId;

        if (!sessionId) {
            // Create new session in DB immediately
            try {
                const res = await window.api.startSession(gameId, start);
                if (res.success && res.sessionId) {
                    sessionId = res.sessionId;
                } else {
                    console.error('Failed to persist session start:', res.error);
                }
            } catch (e) {
                console.error('Error starting session:', e);
            }
        }

        set({ 
          activeSession: { 
            gameId, 
            startTime: start, 
            gameTitle, 
            coverUrl,
            platformId,
            sessionId 
          } 
        });
      },

      stopTimer: async () => {
        const { activeSession, draft } = get();
        
        if (activeSession && activeSession.sessionId) {
            try {
                // Ensure we pass a clean object with all draft details
                const sessionData = {
                    mood: draft.mood,
                    notes: JSON.stringify(draft.notes), // Persist as JSON string for DB
                    journal: draft.journal,
                    platform_id: draft.platformId || activeSession.platformId
                };
                
                await window.api.endSession(activeSession.sessionId, sessionData);
            } catch (e) {
                console.error('Failed to end session in DB:', e);
            }
        }

        set({ activeSession: null, lastUpdate: Date.now() });
        get().clearDraft();
      },

      cancelTimer: () => set({ activeSession: null }),

      setDraftMood: (mood) => set((state) => ({ 
        draft: { ...state.draft, mood } 
      })),
      
      addDraftNote: (note) => set((state) => ({ 
        draft: { ...state.draft, notes: [...(state.draft.notes || []), note] } 
      })),
      
      removeDraftNote: (note) => set((state) => ({ 
        draft: { ...state.draft, notes: state.draft.notes.filter(n => n !== note) } 
      })),
      
      setDraftJournal: (text) => set((state) => ({ 
        draft: { ...state.draft, journal: text } 
      })),
      
      setDraftPlatform: (platformId) => set((state) => ({
        draft: { ...state.draft, platformId }
      })),

      clearDraft: () => set({ draft: { mood: '😶', notes: [], journal: '', platformId: 0 } }),
    }),
    {
      name: 'valis-session-storage',
      // Ensure only the active session and basic draft are persisted
      partialize: (state) => ({ activeSession: state.activeSession, draft: state.draft }),
    }
  )
);