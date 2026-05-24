import { create } from 'zustand';

export type CacheStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CacheEntry<T = unknown> {
  data: T | null;
  status: CacheStatus;
  error?: string | null;
  lastFetched: number;
  ttlMs: number;
  version: number;
}

export interface CachePolicy {
  ttlMs?: number;
}

interface CacheState {
  entries: Record<string, CacheEntry>;
  getEntry: <T = unknown>(key: string) => CacheEntry<T> | undefined;
  setEntry: <T = unknown>(key: string, data: T, policy?: CachePolicy) => void;
  setLoading: (key: string, policy?: CachePolicy) => void;
  setError: (key: string, error: unknown, policy?: CachePolicy) => void;
  invalidate: (key: string) => void;
  invalidatePrefix: (prefix: string) => void;
  clearAll: () => void;
  isFresh: (key: string) => boolean;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const createEntry = (entry?: CacheEntry, policy?: CachePolicy): CacheEntry => ({
  data: entry?.data ?? null,
  status: entry?.status ?? 'idle',
  error: entry?.error ?? null,
  lastFetched: entry?.lastFetched ?? 0,
  ttlMs: policy?.ttlMs ?? entry?.ttlMs ?? DEFAULT_TTL_MS,
  version: entry?.version ?? 0,
});

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown cache error';
};

export const useCacheStore = create<CacheState>((set, get) => ({
  entries: {},

  getEntry: (key) => get().entries[key] as CacheEntry | undefined,

  setEntry: (key, data, policy) => set((state) => {
    const current = createEntry(state.entries[key], policy);
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          data,
          status: 'success',
          error: null,
          lastFetched: Date.now(),
          version: current.version + 1,
        },
      },
    };
  }),

  setLoading: (key, policy) => set((state) => {
    const current = createEntry(state.entries[key], policy);
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          status: 'loading',
          error: null,
          ttlMs: policy?.ttlMs ?? current.ttlMs,
        },
      },
    };
  }),

  setError: (key, error, policy) => set((state) => {
    const current = createEntry(state.entries[key], policy);
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          status: 'error',
          error: toErrorMessage(error),
          ttlMs: policy?.ttlMs ?? current.ttlMs,
          version: current.version + 1,
        },
      },
    };
  }),

  invalidate: (key) => set((state) => {
    const current = state.entries[key];
    if (!current) return state;
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          status: 'idle',
          lastFetched: 0,
          version: current.version + 1,
        },
      },
    };
  }),

  invalidatePrefix: (prefix) => set((state) => {
    let changed = false;
    const next = { ...state.entries };
    for (const [key, entry] of Object.entries(next)) {
      if (key.startsWith(prefix)) {
        changed = true;
        next[key] = {
          ...entry,
          status: 'idle',
          lastFetched: 0,
          version: entry.version + 1,
        };
      }
    }
    return changed ? { entries: next } : state;
  }),

  clearAll: () => set({ entries: {} }),

  isFresh: (key) => {
    const entry = get().entries[key];
    if (!entry || entry.status !== 'success') return false;
    return Date.now() - entry.lastFetched < entry.ttlMs;
  },
}));
