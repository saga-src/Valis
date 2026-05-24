import { useCacheStore } from '../store/cacheStore';
import { cacheKeys } from './cache/cacheKeys';
import { cachePolicies } from './cache/cachePolicy';
import { invalidateSettingsCaches } from './cache/invalidation';

export interface StorageApi {
  saveGame: (game: any) => Promise<any>;
  addGame: (game: any) => Promise<any>;
  getLibrary: () => Promise<any[]>;
  // Add getAnalyticsData to StorageApi interface
  getAnalyticsData: () => Promise<any[]>;
  updateGame: (game: any) => Promise<any>;
  deleteGame: (gameId: string) => Promise<boolean>;
  getSessions: (gameId: string) => Promise<any[]>;
  getAllSessions: () => Promise<any[]>;
  getSessionsPage: (options?: { limit?: number; offset?: number; date?: string }) => Promise<{ sessions: any[]; total: number; limit: number; offset: number; hasMore: boolean }>;
  getRecentSessions: (days: number) => Promise<any[]>;
  saveSession: (session: any) => Promise<any>;
  exportData: () => Promise<boolean>;
  importData: () => Promise<boolean>;
  resetData: () => Promise<boolean>;
  factoryReset: (options: { library: boolean; settings: boolean; accounts: boolean }) => Promise<{ success: boolean; actions?: string[]; error?: string }>;
  refreshMetadata: (options?: { forceAll?: boolean }) => Promise<{ success: boolean; count?: number; error?: string }>;
  proxyImage: (url: string) => Promise<string | null>;
  importSessionsExcel: () => Promise<{ success: boolean; count?: number; gamesCount?: number; message?: string }>;
  exportSessionsExcel: () => Promise<{ success: boolean; message?: string }>;
  selectExecutable: () => Promise<string | null>;
  openFileDialog: () => Promise<string | null>;
  updateWatcherSettings: (settings: { enabled: boolean; interval: number }) => Promise<boolean>;
  onSessionStarted: (callback: (data: { gameId: string; startTime: number; sessionId?: string }) => void) => () => void;
  onSessionEnded: (callback: (data: { gameId: string; duration: number }) => void) => () => void;
  startSession: (gameId: string, startTime: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  endSession: (sessionId: string, data: any) => Promise<{ success: boolean; session?: any; error?: string }>;
  
  addManualSession: (data: any) => Promise<{ success: boolean; sessionId?: string }>;
  updateSession: (sessionId: string, updates: any) => Promise<{ success: boolean }>;
  deleteSession: (sessionId: string) => Promise<{ success: boolean }>;

  // Tags
  getGameTags: (gameId: string) => Promise<string[]>;
  getAllTags: () => Promise<string[]>;
  // Settings
  getSetting: (key: string) => Promise<any>;
  saveSetting: (payload: { key: string, value: any }) => Promise<{ success: boolean }>;
  
  // Auth & Sync
  authPsn: (npsso?: string) => Promise<{ success: boolean; message?: string }>;
  authXbox: () => Promise<{ success: boolean; username?: string; error?: string }>;
  syncPsnLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  syncXboxLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  // Fix: Add openSteamApiKeyPage to StorageApi interface in lib/storage.ts
  openSteamApiKeyPage: () => Promise<{ success: boolean }>;
  
  // Startup
  getStartupStatus: () => Promise<boolean>;
  toggleStartup: (enabled: boolean) => Promise<boolean>;

  // Safe Exit Handshake
  onAppClosing: (callback: () => void) => () => void;
  sendReadyToQuit: () => void;
  getDatabaseFile: () => Promise<Uint8Array>;
  launchGame: (gameId: string) => Promise<{ success: boolean; error?: string }>;
}

export const saveGame = async (game: any) => {
  if (!window.api) return;
  return await window.api.saveGame(game);
};

export const getLibrary = async () => {
  if (!window.api) return [];
  return await window.api.getLibrary();
};

export const getAnalyticsData = async () => {
  if (!window.api) return [];
  return await window.api.getAnalyticsData();
};

export const updateGame = async (game: any) => {
  if (!window.api) return;
  return await window.api.updateGame(game);
};

export const deleteGame = async (gameId: string) => {
  if (!window.api) return false;
  return await window.api.deleteGame(gameId);
};

export const getSessions = async (gameId: string) => {
  if (!window.api) return [];
  return await window.api.getSessions(gameId);
};

export const getAllSessions = async () => {
  if (!window.api) return [];
  return await window.api.getAllSessions();
};

export const getSessionsPage = async (options?: { limit?: number; offset?: number; date?: string }) => {
  if (!window.api) return { sessions: [], total: 0, limit: options?.limit || 0, offset: options?.offset || 0, hasMore: false };
  return await window.api.getSessionsPage(options);
};

export const getRecentSessions = async (days: number) => {
  if (!window.api) return [];
  return await window.api.getRecentSessions(days);
};

export const saveSession = async (session: any) => {
  if (!window.api) return;
  return await window.api.saveSession(session);
};

export const exportData = async () => {
  if (!window.api) return false;
  return await window.api.exportData();
};

export const importData = async () => {
  if (!window.api) return false;
  return await window.api.importData();
};

export const resetData = async () => {
  if (!window.api) return false;
  return await window.api.resetData();
};

export const factoryReset = async (options: { library: boolean; settings: boolean; accounts: boolean }) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.factoryReset(options);
};

export const refreshMetadata = async (options?: { forceAll?: boolean }) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.refreshMetadata(options);
};

export const proxyImage = async (url: string) => {
  if (!window.api) return null;
  return await window.api.proxyImage(url);
};

export const importSessionsExcel = async () => {
  if (!window.api) return { success: false };
  return await window.api.importSessionsExcel();
};

export const exportSessionsExcel = async () => {
  if (!window.api) return { success: false };
  return await window.api.exportSessionsExcel();
};

export const openFileDialog = async () => {
  if (!window.api) return null;
  return await window.api.openFileDialog();
};

export const selectExecutable = async () => {
  if (!window.api) return null;
  return await window.api.openFileDialog();
};

export const updateWatcherSettings = async (settings: { enabled: boolean; interval: number }) => {
  if (!window.api) return false;
  return await window.api.updateWatcherSettings(settings);
};

export const onSessionStarted = (callback: (data: { gameId: string; startTime: number; sessionId?: string }) => void) => {
  if (!window.api) return () => {};
  return window.api.onSessionStarted(callback);
};

export const onSessionEnded = (callback: (data: { gameId: string; duration: number }) => void) => {
  if (!window.api) return () => {};
  return window.api.onSessionEnded(callback);
};

export const startSession = async (gameId: string, startTime: number) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.startSession(gameId, startTime);
};

export const endSession = async (sessionId: string, data: any) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.endSession(sessionId, data);
};

export const addManualSession = async (data: any) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.addManualSession(data);
};

export const updateSession = async (sessionId: string, updates: any) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.updateSession(sessionId, updates);
};

export const deleteSession = async (sessionId: string) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.deleteSession(sessionId);
};

export const getGameTags = async (gameId: string) => {
  if (!window.api) return [];
  return await window.api.getGameTags(gameId);
};

export const getAllTags = async () => {
  if (!window.api) return [];
  return await window.api.getAllTags();
};

export const getSetting = async (key: string) => {
  if (!window.api) return null;
  const cache = useCacheStore.getState();
  const cacheKey = cacheKeys.setting(key);
  if (cache.isFresh(cacheKey)) {
    return cache.getEntry(cacheKey)?.data;
  }
  cache.setLoading(cacheKey, cachePolicies.settings);
  try {
    const value = await window.api.getSetting(key);
    cache.setEntry(cacheKey, value, cachePolicies.settings);
    return value;
  } catch (error) {
    cache.setError(cacheKey, error, cachePolicies.settings);
    throw error;
  }
};

export const saveSetting = async (key: string, value: any) => {
  if (!window.api) return { success: false };
  const result = await window.api.saveSetting({ key, value });
  invalidateSettingsCaches();
  return result;
};

// PSN
export const authPsn = async (npsso?: string) => {
  if (!window.api) return { success: false };
  return await window.api.authPsn(npsso);
};

export const syncPsnLibrary = async () => {
  if (!window.api) return { success: false };
  return await window.api.syncPsnLibrary();
};

// Xbox
export const authXbox = async () => {
  if (!window.api) return { success: false };
  return await window.api.authXbox();
};

export const syncXboxLibrary = async () => {
  if (!window.api) return { success: false };
  return await window.api.syncXboxLibrary();
};

// Fix: Add openSteamApiKeyPage exported wrapper function to lib/storage.ts
export const openSteamApiKeyPage = async () => {
  if (!window.api) return { success: false };
  return await window.api.openSteamApiKeyPage();
};

export const getStartupStatus = async () => {
  if (!window.api) return false;
  return await window.api.getStartupStatus();
};

export const toggleStartup = async (enabled: boolean) => {
  if (!window.api) return false;
  return await window.api.toggleStartup(enabled);
};

// Safe Exit Handshake
export const onAppClosing = (callback: () => void) => {
  if (!window.api) return () => {};
  return window.api.onAppClosing(callback);
};

export const sendReadyToQuit = () => {
  if (!window.api) return;
  window.api.sendReadyToQuit();
};

export const getDatabaseFile = async () => {
    if (!window.api) return new Uint8Array();
    return await window.api.getDatabaseFile();
};

export const launchGame = async (gameId: string) => {
  if (!window.api) return { success: false, error: 'API not available' };
  return await window.api.launchGame(gameId);
};
