const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Games
  saveGame: (game) => ipcRenderer.invoke('db:save-game', game),
  addGame: (game) => ipcRenderer.invoke('add-game', game),
  getLibrary: () => ipcRenderer.invoke('get-library'),
  getAnalyticsData: () => ipcRenderer.invoke('get-analytics-data'),
  getGameById: (id) => ipcRenderer.invoke('get-game-by-id', id),
  updateGame: (game) => ipcRenderer.invoke('db:update-game', game),
  deleteGame: (gameId) => ipcRenderer.invoke('db:delete-game', gameId),
  
  // Tags
  getGameTags: (gameId) => ipcRenderer.invoke('get-game-tags', gameId),
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),

  // Sessions
  getSessions: (gameId) => ipcRenderer.invoke('db:get-sessions', gameId),
  getGameSessions: (gameId) => ipcRenderer.invoke('session:get-by-game', gameId),
  getAllSessions: () => ipcRenderer.invoke('db:get-all-sessions'),
  getRecentSessions: (days) => ipcRenderer.invoke('session:get-recent', days),
  saveSession: (session) => ipcRenderer.invoke('db:save-session', session),
  startSession: (gameId, startTime) => ipcRenderer.invoke('session:start', { gameId, startTime }),
  endSession: (sessionId, data) => ipcRenderer.invoke('session:end', { sessionId, data }),
  
  // Session Management
  addManualSession: (data) => ipcRenderer.invoke('session:add-manual', data),
  updateSession: (sessionId, updates) => ipcRenderer.invoke('session:update', { sessionId, updates }),
  deleteSession: (sessionId) => ipcRenderer.invoke('session:delete', sessionId),

  // Achievements
  getGameAchievements: (gameId) => ipcRenderer.invoke('get-game-achievements', gameId),
  watchAchievements: (gameId, filePath, type) => ipcRenderer.invoke('achievements:watch', { gameId, filePath, type }),
  unwatchAchievements: (filePath) => ipcRenderer.invoke('achievements:unwatch', filePath),
  onAchievementUnlocked: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('achievement:unlocked', subscription);
    return () => ipcRenderer.removeListener('achievement:unlocked', subscription);
  },
  scanAchievements: () => ipcRenderer.invoke('achievements:scan'),
  refreshAchievementsMetadata: () => ipcRenderer.invoke('achievements:refresh-metadata'),
  onAchievementsRefreshProgress: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('achievements:refresh-progress', subscription);
    return () => ipcRenderer.removeListener('achievements:refresh-progress', subscription);
  },

  // Gamification
  getGamificationStatus: () => ipcRenderer.invoke('getGamificationStatus'),
  unlockMark: (markId) => ipcRenderer.invoke('unlockMark', markId),
  onMilestoneUnlocked: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('MILESTONE_UNLOCKED', subscription);
    return () => ipcRenderer.removeListener('MILESTONE_UNLOCKED', subscription);
  },
  addPlaytimeXP: (amount) => ipcRenderer.invoke('addPlaytimeXP', amount),
  getSyncStats: () => ipcRenderer.invoke('gamification:get-sync-stats'),

  // System
  factoryReset: (options) => ipcRenderer.invoke('system:factory-reset', options),
  resetData: () => ipcRenderer.invoke('system:factory-reset', { library: true, settings: true, accounts: true }), // Backward compat
  wipeUserData: () => ipcRenderer.invoke('system:wipe-user-data'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  openSteamApiKeyPage: () => ipcRenderer.invoke('open-steam-apikey-page'),
  
  refreshMetadata: (options) => ipcRenderer.invoke('db:refresh-metadata', options),
  onMetadataProgress: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('metadata-progress', subscription);
    return () => ipcRenderer.removeListener('metadata-progress', subscription);
  },
  
  searchGames: (query) => ipcRenderer.invoke('igdb:search', query),
  searchGame: (query) => ipcRenderer.invoke('igdb:search', query),
  fetchIGDBGame: (id) => ipcRenderer.invoke('igdb:get-by-id', id),
  
  proxyImage: (url) => ipcRenderer.invoke('app:proxy-image', url),
  
  // System Metadata
  getSystemMeta: () => ipcRenderer.invoke('system:get-meta'),
  setSystemMeta: (key, value) => ipcRenderer.invoke('system:set-meta', key, value),
  restoreBackup: (data) => ipcRenderer.invoke('system:restore-backup', data),
  getDatabaseDump: () => ipcRenderer.invoke('system:get-database-dump'),

  // Excel
  importSessionsExcel: () => ipcRenderer.invoke('excel:import-sessions'),
  exportSessionsExcel: () => ipcRenderer.invoke('excel:export-sessions'),
  exportExcel: () => ipcRenderer.invoke('excel:export-sessions'),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  saveSetting: (payload) => ipcRenderer.invoke('settings:save', payload),
  testIgdbConnection: (clientId, clientSecret) => ipcRenderer.invoke('settings:test-igdb', { clientId, clientSecret }),
  
  // Watch Paths Settings
  getWatchPaths: () => ipcRenderer.invoke('settings:get-watch-paths'),
  addWatchPath: (path, type) => ipcRenderer.invoke('settings:add-watch-path', { path, type }),
  removeWatchPath: (id) => ipcRenderer.invoke('settings:remove-watch-path', id),
  checkPathExists: (path) => ipcRenderer.invoke('settings:check-path-exists', path),

  // Linked Accounts
  getLinkedAccounts: (platform) => ipcRenderer.invoke('settings:get-linked-accounts', platform),
  unlinkAccount: (id) => ipcRenderer.invoke('settings:unlink-account', id),

  // Auth
  authSteam: () => ipcRenderer.invoke('auth:steam'),
  authEpic: () => ipcRenderer.invoke('auth:epic'),
  authPsn: (npsso) => ipcRenderer.invoke('auth:psn', npsso),
  authXbox: () => ipcRenderer.invoke('auth:xbox'),
  getSteamUser: () => ipcRenderer.invoke('auth:get-steam-user'),
  
  // Sync
  syncSteamLibrary: () => ipcRenderer.invoke('settings:sync-steam'),
  syncEpicLibrary: () => ipcRenderer.invoke('settings:sync-epic'),
  syncPsnLibrary: () => ipcRenderer.invoke('settings:sync-psn'), 
  syncXboxLibrary: () => ipcRenderer.invoke('settings:sync-xbox'),
  onSteamSyncProgress: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('steam:sync-progress', subscription);
    return () => ipcRenderer.removeListener('steam:sync-progress', subscription);
  },

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  startDownload: () => ipcRenderer.invoke('update:start-download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onUpdateAvailable: (callback) => {
    const subscription = (_, info) => callback(info);
    ipcRenderer.on('update:available', subscription);
    return () => ipcRenderer.removeListener('update:available', subscription);
  },
  onUpdateProgress: (callback) => {
    const subscription = (_, progress) => callback(progress);
    ipcRenderer.on('update:progress', subscription);
    return () => ipcRenderer.removeListener('update:progress', subscription);
  },
  onUpdateDownloaded: (callback) => {
    const subscription = (_, info) => callback(info);
    ipcRenderer.on('update:downloaded', subscription);
    return () => ipcRenderer.removeListener('update:downloaded', subscription);
  },
  onUpdateError: (callback) => {
    const subscription = (_, error) => callback(error);
    ipcRenderer.on('update:error', subscription);
    return () => ipcRenderer.removeListener('update:error', subscription);
  },

  // Startup
  getStartupStatus: () => ipcRenderer.invoke('system:get-startup-status'),
  toggleStartup: (enabled) => ipcRenderer.invoke('system:toggle-startup', enabled),

  // Executable Linking
  selectExecutable: () => ipcRenderer.invoke('dialog:select-executable'),
  updateWatcherSettings: (settings) => ipcRenderer.invoke('watcher:update-settings', settings),

  // Watcher Events
  onSessionStarted: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('watcher:session-started', subscription);
    return () => ipcRenderer.removeListener('watcher:session-started', subscription);
  },
  onSessionEnded: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('watcher:session-ended', subscription);
    return () => ipcRenderer.removeListener('watcher:session-ended', subscription);
  },

  // Audio / FX
  onPlaySound: (callback) => {
    const subscription = (_, soundName) => callback(soundName);
    ipcRenderer.on('play-sound', subscription);
    return () => ipcRenderer.removeListener('play-sound', subscription);
  },

  // Updates
  onUpdateStatus: (callback) => {
    const subscription = (_, status) => callback(status);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.removeListener('update-status', subscription);
  },

  // Notification
  testNotification: (config) => ipcRenderer.send('test-notification', config),

  // Debugging
  log: (...args) => ipcRenderer.send('log-to-terminal', ...args),
});