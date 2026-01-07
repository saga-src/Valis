import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { initDB } from './db/init.js';
import { registerGameHandlers } from './ipc/games.js';
import { registerSessionHandlers } from './ipc/sessions.js';
import { registerSystemHandlers } from './ipc/system.js';
import { setupAchievementsHandlers } from './ipc/achievements.js';
import { registerSettingsHandlers } from './ipc/settings.js';
import { registerGamificationHandlers } from './ipc/gamification.js'; // NEW
import { gameWatcher } from './services/ProcessWatcher.js';
import { achievementWatcher } from './services/FileWatcherService.js';
import * as igdb from './lib/igdb.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let proxyProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Valis | Personal Game Journal Vault",
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '../public/images/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
  });

  // Remove the native menu bar (File, Edit, etc.) for a cleaner app look
  mainWindow.removeMenu();

  // CRITICAL: Force all external links (starting with http) to open in the real OS browser
  // This fixes the "Manual Entry" link opening in a broken Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' }; // Stop Electron from opening it internally
    }
    return { action: 'allow' };
  });

  // Initialize achievement watcher with window reference for IPC
  achievementWatcher.init(mainWindow);

  // Load Vite Dev Server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('http://localhost:3000');
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

app.whenReady().then(async () => {
  await initDB();

  // Updated to point to services folder and pass userData path for DB access
  const proxyPath = path.join(__dirname, 'services/ProxyServer.js');
  console.log('Starting Proxy from:', proxyPath);
  
  proxyProcess = fork(proxyPath, [], {
    env: { ...process.env, USER_DATA_PATH: app.getPath('userData') }
  });

  createWindow();

  registerGameHandlers();
  registerSessionHandlers();
  registerSystemHandlers();
  setupAchievementsHandlers(mainWindow);
  registerSettingsHandlers();
  registerGamificationHandlers(); // Register new handlers
  registerLegacyHandlers();

  gameWatcher.start(mainWindow, 5000);

  // Initialize Auto-Updater
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-status', 'available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-status', 'downloaded');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Valis has been downloaded. Restart now to install?',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

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