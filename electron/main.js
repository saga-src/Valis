
import { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } from 'electron';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import electronUpdater from 'electron-updater';
import { initDB } from './db/init.js';
import { registerGameHandlers } from './ipc/games.js';
import { registerSessionHandlers } from './ipc/sessions.js';
import { registerSystemHandlers } from './ipc/system.js';
import { setupAchievementsHandlers } from './ipc/achievements.js';
import { registerSettingsHandlers } from './ipc/settings.js';
import { registerGamificationHandlers } from './ipc/gamification.js'; // NEW
import { registerImageHandlers } from './ipc/images.js'; // NEW
import { gameWatcher } from './services/ProcessWatcher.js';
import { achievementWatcher } from './services/FileWatcherService.js';
import * as igdb from './lib/igdb.js';
import fs from 'fs';

if (process.platform === 'win32') {
  app.setAppUserModelId('com.valis.app'); 
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { autoUpdater } = electronUpdater;

let mainWindow;
let proxyProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Valis | Personal Game Journal Vault",
    backgroundColor: '#09090b',
    // ⚠️ PATH FIX: The main process is now in 'dist-electron/main', 
    // so we go up 2 levels to find 'public' (or 'dist' in prod).
    icon: path.join(__dirname, '../../public/images/logo.png'), 
    webPreferences: {
      // ✅ FIXED: Points to the compiled preload script relative to dist-electron/main
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
  });

  // Preserve your clean UI logic
  mainWindow.removeMenu();

  // Preserve your External Link Handler (Critical for User Experience)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' }; 
    }
    return { action: 'allow' };
  });

  // Preserve your Achievement Watcher
  if (global.achievementWatcher) {
      achievementWatcher.init(mainWindow);
  }

  // ⚡️ NEW UNIFIED LOADING LOGIC
  if (process.env.VITE_DEV_SERVER_URL) {
    // In Dev: Load the URL provided by the Vite plugin
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    //mainWindow.webContents.openDevTools();
  } else {
    // In Prod: Load the index.html from the dist folder
    // Path: dist-electron/main/ -> ../../dist/index.html
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));

    //mainWindow.webContents.openDevTools(); 
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerLegacyHandlers() {
  ipcMain.handle('watcher:update-settings', async (_, settings) => {
    const { enabled, interval } = settings;
    if (enabled) {
      gameWatcher.stop();
      gameWatcher.start(mainWindow, interval);
    } else {
      gameWatcher.stop();
    }
    return true;
  });

  ipcMain.handle('app:proxy-image', async (_, url) => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
    } catch (e) {
        console.error('[Proxy] Image fetch failed:', e);
        return null;
    }
  });

  ipcMain.handle('dialog:select-executable', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Game Executable',
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return path.basename(filePaths[0]);
  });

  ipcMain.handle('db:export-data', async () => {
    return false;
  });

  ipcMain.handle('db:import-data', async () => {
    return false;
  });

  ipcMain.handle('db:reset-data', async () => {
    return true;
  });

  ipcMain.on('log-to-terminal', (event, ...args) => {
    console.log('\x1b[36m[Renderer]\x1b[0m', ...args);
  });
}

// ⚡ UPDATER LOGIC
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('update:progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    mainWindow?.webContents.send('update:downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err);
    mainWindow?.webContents.send('update:error', err.message);
  });

  ipcMain.handle('update:check', () => {
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle('update:start-download', () => {
    return autoUpdater.downloadUpdate();
  });

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(async () => {
  await initDB();

  // Updated to point to services folder and pass userData path for DB access
  // In production/unified build, the proxy is a sibling file
  const proxyPath = app.isPackaged || process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, 'ProxyServer.js') 
    : path.join(__dirname, 'services/ProxyServer.js');
  console.log('Starting Proxy from:', proxyPath);
  
  proxyProcess = fork(proxyPath, [], {
    env: { ...process.env, USER_DATA_PATH: app.getPath('userData') }
  });

  createWindow();
  setupAutoUpdater();

  registerGameHandlers();
  registerSessionHandlers();
  registerSystemHandlers();
  setupAchievementsHandlers(mainWindow);
  registerSettingsHandlers();
  registerGamificationHandlers(); 
  registerImageHandlers(); // Register new image handler
  registerLegacyHandlers();

  gameWatcher.start(mainWindow, 5000);

  // Initial check
  autoUpdater.checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (proxyProcess) {
      console.log('Killing proxy server...');
      proxyProcess.kill();
    }
    gameWatcher.stop();
    app.quit();
  }
});
