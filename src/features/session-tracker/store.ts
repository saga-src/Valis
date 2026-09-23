import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DraftSession {
  mood: string;
  notes: string[];
  journal: string;
  platformId?: number;
}

type ActiveSession = {
  gameId: string;
  startTime: number;
  gameTitle: string;
  coverUrl?: string;
  platformId?: number;
  sessionId?: string;
};

const emptyDraft = (): DraftSession => ({ mood: '😶', notes: [], journal: '', platformId: 0 });
const sessionData = (draft: DraftSession, active: ActiveSession) => ({
  mood: draft.mood,
  notes: JSON.stringify(draft.notes),
  journal: draft.journal,
  platform_id: draft.platformId || active.platformId || null
});

let sessionOperationInFlight = false;

interface SessionState {
  activeSession: ActiveSession | null;
  lastUpdate: number; // Timestamp to trigger re-renders/refetches in components
  isBusy: boolean;
  sessionError: string | null;
  startTimer: (gameId: string, gameTitle: string, coverUrl?: string, platformId?: number, startTime?: number, existingSessionId?: string) => Promise<boolean>;
  stopTimer: (endTime?: number) => Promise<'finished' | 'already-finished' | false>;
  handlePersistedEnd: (sessionId: string) => Promise<void>;
  recoverActiveSession: () => Promise<void>;
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
      isBusy: false,
      sessionError: null,
      draft: emptyDraft(),

      startTimer: async (gameId, gameTitle, coverUrl, platformId, startTime, existingSessionId) => {
        if (sessionOperationInFlight) return false;
        sessionOperationInFlight = true;
        set({ isBusy: true, sessionError: null });
        try {
          const previous = get().activeSession;
          let sessionId = existingSessionId;
          let actualStart = startTime ?? Date.now();
          let previousSessionId = previous?.sessionId;
          if (previous && !previous.sessionId && previous.gameId !== gameId) {
            const persisted = await window.api.getActiveSession();
            if (persisted?.game_id === previous.gameId) {
              previousSessionId = persisted.id;
            } else if (!persisted) {
              const recovered = await window.api.startSession(previous.gameId, previous.startTime);
              if (!recovered.success || !recovered.sessionId) throw new Error(recovered.error || 'The previous session could not be recovered');
              previousSessionId = recovered.sessionId;
            } else {
              throw new Error('The previous session needs recovery before switching games');
            }
          }
          if (existingSessionId) {
            // The watcher has already committed the transition. Attach the old draft
            // to its finished row before replacing the visible timer.
            if (previous && !previousSessionId && previous.gameId !== gameId) {
              throw new Error('The previous session needs recovery before switching games');
            }
            if (previousSessionId && previousSessionId !== existingSessionId) {
              const saved = await window.api.saveSessionDraft(previousSessionId, sessionData(get().draft, previous!));
              if (!saved.success) throw new Error(saved.error || 'Could not save the previous session notes');
            }
          } else {
            const result = await window.api.startSession(gameId, actualStart,
              previousSessionId && previous?.gameId !== gameId
                ? { previousSessionId, previousData: sessionData(get().draft, previous!) }
                : undefined);
            if (!result.success || !result.sessionId) throw new Error(result.error || 'Could not start the session');
            sessionId = result.sessionId;
            actualStart = result.startTime ?? actualStart;
          }
          if (!sessionId) throw new Error('The session has no saved ID');
          const changed = previous?.sessionId !== sessionId;
          set({
            activeSession: { gameId, startTime: actualStart, gameTitle, coverUrl, platformId, sessionId },
            draft: changed && previous && previous.gameId !== gameId ? emptyDraft() : get().draft,
            lastUpdate: Date.now(),
            sessionError: null
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not start the session';
          console.error('Failed to start session:', error);
          set({ sessionError: message });
          return false;
        } finally {
          sessionOperationInFlight = false;
          set({ isBusy: false });
        }
      },

      stopTimer: async (endTime = Date.now()) => {
        if (sessionOperationInFlight) return false;
        const { activeSession, draft } = get();
        if (!activeSession?.sessionId) {
          if (activeSession) {
            await get().recoverActiveSession();
            if (get().activeSession?.sessionId) return get().stopTimer(endTime);
          }
          set({ sessionError: get().sessionError || 'This timer could not be recovered. Its notes are kept.' });
          return false;
        }
        sessionOperationInFlight = true;
        set({ isBusy: true, sessionError: null });
        try {
          const data = { ...sessionData(draft, activeSession), end_time: endTime };
          const result = await window.api.endSession(activeSession.sessionId, data);
          if (!result.success || !result.status) throw new Error(result.error || 'The session could not be finalized');
          if (result.status === 'already-finished') {
            const saved = await window.api.saveSessionDraft(activeSession.sessionId, data);
            if (!saved.success) throw new Error(saved.error || 'Could not save the session notes');
          }
          if (get().activeSession?.sessionId === activeSession.sessionId) {
            set({ activeSession: null, draft: emptyDraft(), lastUpdate: Date.now(), sessionError: null });
          }
          return result.status;
        } catch (error) {
          console.error('Failed to end session in DB:', error);
          set({ sessionError: error instanceof Error ? error.message : 'Could not end the session' });
          return false;
        } finally {
          sessionOperationInFlight = false;
          set({ isBusy: false });
        }
      },

      handlePersistedEnd: async (sessionId) => {
        const active = get().activeSession;
        if (!active || active.sessionId !== sessionId || sessionOperationInFlight) return;
        sessionOperationInFlight = true;
        set({ isBusy: true });
        try {
          const saved = await window.api.saveSessionDraft(sessionId, sessionData(get().draft, active));
          if (!saved.success) throw new Error(saved.error || 'Could not save session notes');
          if (get().activeSession?.sessionId === sessionId) {
            set({ activeSession: null, draft: emptyDraft(), lastUpdate: Date.now(), sessionError: null });
          }
        } catch (error) {
          set({ sessionError: error instanceof Error ? error.message : 'Could not save session notes' });
        } finally {
          sessionOperationInFlight = false;
          set({ isBusy: false });
        }
      },

      recoverActiveSession: async () => {
        if (sessionOperationInFlight) return;
        sessionOperationInFlight = true;
        try {
          const persisted = await window.api.getActiveSession();
          const local = get().activeSession;
          if (local && !local.sessionId && persisted && persisted.game_id !== local.gameId) {
            throw new Error('The previous timer has no saved ID; its draft is kept for recovery');
          }
          if (local?.sessionId && local.sessionId !== persisted?.id) {
            const saved = await window.api.saveSessionDraft(local.sessionId, sessionData(get().draft, local));
            if (!saved.success) throw new Error(saved.error || 'Could not recover previous session notes');
          }
          if (persisted) {
            if (persisted.id === local?.sessionId || persisted.game_id === local?.gameId) {
              set({ activeSession: {
                ...local,
                gameId: persisted.game_id,
                startTime: persisted.start_time,
                gameTitle: local?.gameTitle || 'Game',
                sessionId: persisted.id
              }, sessionError: null });
            } else {
              set({ activeSession: {
                gameId: persisted.game_id,
                startTime: persisted.start_time,
                gameTitle: 'Game',
                sessionId: persisted.id
              }, draft: emptyDraft(), sessionError: null });
            }
          } else if (local && !local.sessionId) {
            const started = await window.api.startSession(local.gameId, local.startTime);
            if (started.success && started.sessionId) {
              set({ activeSession: {
                ...local,
                startTime: started.startTime ?? local.startTime,
                sessionId: started.sessionId
              }, lastUpdate: Date.now(), sessionError: null });
            } else {
              // There is no database row to end. Keep the notes but free the UI
              // so a deleted or invalid legacy game cannot trap the tracker.
              set({ activeSession: null, lastUpdate: Date.now(), sessionError: started.error || 'The old timer could not be saved. Its notes are kept.' });
            }
          } else if (local?.sessionId) {
            set({ activeSession: null, draft: emptyDraft(), lastUpdate: Date.now(), sessionError: null });
          }
        } catch (error) {
          set({ sessionError: error instanceof Error ? error.message : 'Could not recover the session' });
        } finally {
          sessionOperationInFlight = false;
        }
      },

      cancelTimer: () => { void get().stopTimer(); },

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

      clearDraft: () => set({ draft: emptyDraft() }),
    }),
    {
      name: 'valis-session-storage',
      // Ensure only the active session and basic draft are persisted
      partialize: (state) => ({ activeSession: state.activeSession, draft: state.draft }),
    }
  )
);
