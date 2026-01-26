import { ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as db from '../db/queries.js';
import * as igdb from '../lib/igdb.js';
import { cloudGate } from '../services/CloudGate.js';
import achievementOrchestrator from '../services/AchievementOrchestrator.js';
import { saveAchievementsToDb } from '../db/modules/achievements.js';
import { incrementUserStat } from '../db/modules/gamification.js';

// Helper to notify all windows
const broadcastLibraryUpdate = (event) => {
    if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('library-updated'); 
    }
};

/**
 * Helper to trigger background achievement scraping after a game is added.
 */
const triggerAutoScrape = async (event, game, result) => {
    if (result && result.success) {
        // ⚡ RE-FETCH FROM DB 
        const gameId = result.id || game.id;
        const savedGame = await db.getGameById(gameId);
        
        if (savedGame) {
            console.log(`[Auto-Scrape] Triggering background fetch for: ${savedGame.name || savedGame.title} (PSN ID: ${savedGame.psn_id})`);
            
            // Run in background (do not await)
            achievementOrchestrator.fetchAchievements(savedGame)
                .then(async (data) => {
                    if (data && data.length > 0) {
                        console.log(`[Auto-Scrape] Saved ${data.length} achievements for ${savedGame.name || savedGame.title}`);
                        await saveAchievementsToDb(gameId, data);
                        // Notify frontend that achievements might have changed
                        if (event && event.sender && !event.sender.isDestroyed()) {
                            event.sender.send('achievements-updated', { gameId: gameId });
                        }
                    }
                })
                .catch(err => console.error('[Auto-Scrape] Failed:', err));
        }
    }
};

export function registerGameHandlers() {
  // Normalized Bridge
  ipcMain.handle('get-library', async () => {
    return await db.getLibrary();
  });

  ipcMain.handle('get-analytics-data', async () => {
    return await db.getAnalyticsData();
  });

  ipcMain.handle('add-game', async (event, game) => {
    const result = await db.addGame(game);
    // ⚡ FABRICATOR TRIGGER: Increment if manual add
    if (result && result.success && !game.isSilent) {
        await incrementUserStat('manual_games_added', 1);
    }
    broadcastLibraryUpdate(event);
    triggerAutoScrape(event, game, result);
    return result;
  });

  ipcMain.handle('get-game-by-id', async (event, id) => {
    return await db.getGameById(id);
  });

  // Database Accessors
  ipcMain.handle('db:get-library', async () => {
    return await db.getLibrary();
  });

  ipcMain.handle('db:get-game', async (event, id) => {
    return await db.getGameById(id);
  });

  ipcMain.handle('db:add-game', async (event, game) => {
    const result = await db.addGame(game);
    // ⚡ FABRICATOR TRIGGER
    if (result && result.success && !game.isSilent) {
        await incrementUserStat('manual_games_added', 1);
    }
    broadcastLibraryUpdate(event);
    triggerAutoScrape(event, game, result);
    return result;
  });

  ipcMain.handle('db:save-game', async (event, game) => {
    const result = await db.addGame(game);
    // ⚡ FABRICATOR TRIGGER
    if (result && result.success && !game.isSilent) {
        await incrementUserStat('manual_games_added', 1);
    }
    broadcastLibraryUpdate(event);
    triggerAutoScrape(event, game, result);
    return result;
  });

  ipcMain.handle('db:update-game', async (event, game) => {
    const result = await db.updateGame(game);
    broadcastLibraryUpdate(event);
    return result;
  });

  ipcMain.handle('db:delete-game', async (event, id) => {
    const result = await db.deleteGame(id);
    broadcastLibraryUpdate(event);
    return result;
  });

  // Tag Handlers
  ipcMain.handle('get-game-tags', async (event, gameId) => {
    return await db.getGameTags(gameId);
  });

  ipcMain.handle('get-all-tags', async () => {
    return await db.getAllUniqueTags();
  });
  
  // File Picker Handler
  ipcMain.handle('dialog:open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe'] }]
    });
    if (canceled) return null;
    return filePaths[0]; 
  });

  // IGDB Search Handler (Uses CloudGate via lib/igdb)
  ipcMain.handle('igdb:search', async (event, query) => {
    return await igdb.searchIGDB(query);
  });
  
  // IGDB Fetch Single Game Handler
  ipcMain.handle('igdb:get-by-id', async (event, id) => {
    return await igdb.fetchIGDBMetadata(id);
  });

  // Metadata Refresh Handler (Leverages CloudGate's built-in queueing)
  ipcMain.handle('db:refresh-metadata', async (event, { forceAll = true } = {}) => {
    try {
      const games = await db.getLibrary();
      const total = games.length;
      let updatedCount = 0;
      let current = 0;

      for (const game of games) {
        current++;
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('metadata-progress', { current, total, gameName: game.title || game.name });
        }
        if (!String(game.id).match(/^\d+$/)) continue; 
        try {
          const metadata = await igdb.fetchIGDBMetadata(game.id);
          if (metadata) {
            await db.updateGameMetadata(game.id, metadata);
            if (metadata.steam_id) {
               await db.refreshSteamAchievements(game.id, metadata.steam_id);
            }
            updatedCount++;
          }
        } catch (e) {}
      }
      if (updatedCount > 0) broadcastLibraryUpdate(event);
      return { success: true, count: updatedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Achievements
  ipcMain.handle('get-game-achievements', async (event, gameId) => {
    return await db.getAchievements(gameId);
  });

  // Launcher
  ipcMain.handle('launch-game', async (event, gameId) => {
    console.log(`[Launch Debug] Request received for game ID: ${gameId}`);
    try {
      const game = await db.getGameById(gameId);
      if (!game || !game.executable) {
        console.error(`[Launch Error] No executable found for game ID: ${gameId}`);
        throw new Error('No executable linked for this game');
      }

      const exePath = game.executable;
      console.log(`[Launch Debug] Found exe path: ${exePath}`);

      if (!fs.existsSync(exePath)) {
        console.error(`[Launch Error] Path does not exist on disk: ${exePath}`);
        throw new Error(`File not found: ${exePath}`);
      }

      console.log(`[Launch Debug] Spawning process...`);
      const child = spawn(exePath, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(exePath)
      });

      child.on('error', (err) => {
        console.error('[Launch Error] Spawn failed:', err);
      });

      child.on('spawn', async () => {
        console.log('[Launch Debug] Process spawned successfully with PID:', child.pid);
        // ⚡ OPERATOR TRIGGER: Increment launcher starts
        try {
            await incrementUserStat('launcher_starts', 1);
        } catch(e) {
            console.warn('[Launch] Failed to increment launcher metric:', e);
        }
      });

      child.unref();
      return { success: true };
    } catch (error) {
      console.error('[Launch Error] Catch-all:', error);
      return { success: false, error: error.message };
    }
  });
}
