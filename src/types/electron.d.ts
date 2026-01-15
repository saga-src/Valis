
export interface StorageApi {
  saveGame: (game: any) => Promise<any>;
  addGame: (game: any) => Promise<any>;
  getLibrary: () => Promise<any[]>;
  // Add getAnalyticsData to StorageApi interface
  getAnalyticsData: () => Promise<any[]>;
  getGameById: (id: string) => Promise<any>;
  updateGame: (game: any) => Promise<any>;
  disabled?: boolean;
  deleteGame: (gameId: string) => Promise<boolean>;
  getSessions: (gameId: string) => Promise<any[]>;
  getGameSessions: (gameId: string) => Promise<any[]>;
  getAllSessions: () => Promise<any[]>;
  getRecentSessions: (days: number) => Promise<any[]>;
  saveSession: (session: any) => Promise<any>;
  exportData: () => Promise<boolean>;
  importData: () => Promise<boolean>;
  resetData: () => Promise<boolean>;
  factoryReset: (options: { library: boolean; settings: boolean; accounts: boolean }) => Promise<{ success: boolean; actions?: string[]; error?: string }>;
  refreshMetadata: (options?: { forceAll?: boolean }) => Promise<{ success: boolean; count?: number; error?: string }>;
  onMetadataProgress: (callback: (data: { current: number; total: number; gameName: string }) => void) => () => void;
  searchGames: (query: string) => Promise<any[]>; // Plural
  searchGame: (query: string) => Promise<any[]>; // Singular
  fetchIGDBGame: (id: string) => Promise<any>; // Fetch Single Game Metadata
  proxyImage: (url: string) => Promise<string | null>;
  cacheLibraryImages: (games: any[]) => Promise<{ queued: boolean }>;
  getImagePath: (url: string, gameId: string) => Promise<string | null>;
  importSessionsExcel: () => Promise<{ success: boolean; count?: number; gamesCount?: number; message?: string }>;
  exportSessionsExcel: () => Promise<{ success: boolean; message?: string }>;
  selectExecutable: () => Promise<string | null>;
  updateWatcherSettings: (settings: { enabled: boolean; interval: number }) => Promise<boolean>;
  onSessionStarted: (callback: (data: { gameId: string; startTime: number; sessionId?: string }) => void) => () => void;
  onSessionEnded: (callback: (data: { gameId: string; duration: number }) => void) => () => void;
  startSession: (gameId: string, startTime: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  endSession: (sessionId: string, data: any) => Promise<{ success: boolean; session?: any; error?: string }>;
  
  // Manual Session Management
  addManualSession: (data: any) => Promise<{ success: boolean; sessionId?: string }>;
  updateSession: (sessionId: string, updates: any) => Promise<{ success: boolean }>;
  deleteSession: (sessionId: string) => Promise<{ success: boolean }>;

  log: (...args: any[]) => void;

  // System Stats
  getSystemStats: () => Promise<{ cpuLoad: number; memUsed: number; gpuLoad: number; gpuName: string }>;
  openExternal: (url: string) => Promise<{ success: boolean }>;
  wipeUserData: () => Promise<{ success: boolean; error?: string }>;

  // Achievement Management
  getGameAchievements: (gameId: string) => Promise<any[]>;
  watchAchievements: (gameId, filePath, type: 'goldberg' | 'codex') => Promise<{ success: boolean }>;
  unwatchAchievements: (filePath: string) => Promise<{ success: boolean }>;
  onAchievementUnlocked: (callback: (data: any) => void) => () => void;
  scanAchievements: () => Promise<{ success: boolean; count?: number; message?: string }>;
  refreshAchievementsMetadata: () => Promise<{ success: boolean; processed?: number; updated?: number; error?: string }>;
  onAchievementsRefreshProgress: (callback: (data: { current: number; total: number; gameName: string }) => void) => () => void;

  // Gamification
  getGamificationStatus: () => Promise<{ metrics: Record<string, number>; totalXP: number; unlockedTiers: string[]; unlockedMarks: string[]; tree: any[] }>;
  unlockMark: (markId: string) => Promise<boolean>;
  onMilestoneUnlocked: (callback: (data: any) => void) => () => void;
  addPlaytimeXP: (amount: number) => Promise<number>;
  getSyncStats: () => Promise<any>;

  // Watch Paths Settings
  getWatchPaths: () => Promise<Array<{ id: number; path: string; type: 'goldberg' | 'codex'; recursive: number }>>;
  addWatchPath: (path: string, type: 'goldberg' | 'codex') => Promise<{ id: number; path: string; type: string; recursive: number }>;
  removeWatchPath: (id: number) => Promise<boolean>;
  checkPathExists: (path: string) => Promise<boolean>;

  // Tags
  getGameTags: (gameId: string) => Promise<string[]>;
  getAllTags: () => Promise<string[]>;

  // Settings
  getSetting: (key: string) => Promise<any>;
  saveSetting: (payload: { key: string, value: any }) => Promise<{ success: boolean }>;
  testIgdbConnection: (clientId: string, clientSecret: string) => Promise<{ success: boolean; error?: string }>;

  // Linked Accounts
  getLinkedAccounts: (platform?: string) => Promise<Array<{ id: number; platform: string; external_id: string; username: string; avatar_url: string; created: number }>>;
  unlinkAccount: (id: number) => Promise<{ success: boolean }>;

  // Auth
  authSteam: () => Promise<{ success: boolean; steamId?: string; message?: string }>;
  authEpic: () => Promise<{ success: boolean; message?: string }>;
  authPsn: (npsso?: string) => Promise<{ success: boolean; message?: string }>;
  authXbox: () => Promise<{ success: boolean; username?: string; error?: string }>;
  getSteamUser: () => Promise<{ steamId?: string }>;
  syncSteamLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  syncEpicLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  syncPsnLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  syncXboxLibrary: () => Promise<{ success: boolean; added?: number; synced?: number; error?: string }>;
  onSteamSyncProgress: (callback: (data: { message: string }) => void) => () => void;
  // Fix: Add openSteamApiKeyPage to StorageApi interface in types/electron.d.ts
  openSteamApiKeyPage: () => Promise<{ success: boolean }>;

  // Updater
  checkForUpdates: () => Promise<any>;
  startDownload: () => Promise<any>;
  quitAndInstall: () => void;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
  onUpdateProgress: (callback: (progress: any) => void) => () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;

  // Startup
  getStartupStatus: () => Promise<boolean>;
  toggleStartup: (enabled: boolean) => Promise<boolean>;

  // Audio
  onPlaySound: (callback: (soundName: string) => void) => () => void;

  // Updates
  onUpdateStatus: (callback: (status: 'available' | 'downloaded') => void) => () => void;

  // Notification
  testNotification: (config?: { toast?: boolean; sound?: boolean }) => void;

  // System Metadata
  getSystemMeta: () => Promise<Record<string, string>>;
  setSystemMeta: (key: string, value: string) => Promise<{ success: boolean }>;
  restoreBackup: (data: any) => Promise<{ success: boolean; error?: string }>;
  getDatabaseDump: () => Promise<{ data: any }>;
}

declare global {
  interface Window {
    api: StorageApi;
  }
}
