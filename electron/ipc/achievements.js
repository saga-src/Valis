import { ipcMain } from 'electron';
import { achievementWatcher } from '../services/FileWatcherService.js';
import * as db from '../db/queries.js';
import { saveAchievementsToDb } from '../db/modules/achievements.js';
import { getLibrary } from '../db/modules/games.js';
import achievementOrchestrator from '../services/AchievementOrchestrator.js';

export function setupAchievementsHandlers(mainWindow) {
  /**
   * Request the service to monitor a local achievement file.
   */
  ipcMain.handle('achievements:watch', async (event, { gameId, filePath, type }) => {
    try {
      achievementWatcher.watch(gameId, filePath, type);
      return { success: true };
    } catch (error) {
      console.error('[IPC] achievements:watch failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Stop monitoring a local achievement file.
   */
  ipcMain.handle('achievements:unwatch', async (event, filePath) => {
    achievementWatcher.unwatch(filePath);
    return { success: true };
  });

  /**
   * Get all achievements for a game (definitions + progress).
   */
  ipcMain.handle('achievements:get', async (event, gameId) => {
    return await db.getAchievements(gameId);
  });

  /**
   * Manual Scan Trigger
   */
  ipcMain.handle('achievements:scan', async () => {
    return await achievementWatcher.scanAll();
  });

  /**
   * Refresh Metadata for ALL Games across connected platforms
   */
  ipcMain.handle('achievements:refresh-metadata', async () => {
    console.log('[IPC] Starting global achievement metadata refresh...');
    try {
      // 1. Get all games from library
      const allGames = await getLibrary();
      console.log('[IPC] Total Games in Library:', allGames.length);
      
      // 2. Filter for games that have valid platform IDs for syncing
      const validGames = allGames.filter(g => 
        (g.steam_id && g.steam_id !== '' && g.steam_id !== 'undefined') || 
        g.psn_trophy_id || 
        (g.xbox_market_id || g.xbox_store_id)
      );

      console.log('[IPC] Games with valid Achievement IDs:', validGames.length);
      
      let processed = 0;
      let updated = 0;

      for (const game of validGames) {
        processed++;
        
        // Send progress to frontend
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('achievements:refresh-progress', {
                current: processed,
                total: validGames.length,
                gameName: game.title || game.name
            });
        }

        try {
            console.log('[IPC] Triggering refresh for:', game.title || game.name);
            
            // ⚡ Use Orchestrator to fetch latest status from appropriate source
            const data = await achievementOrchestrator.fetchAchievements(game);
            
            if (data && data.length > 0) {
                console.log('[IPC] Saving', data.length, 'records for', game.title || game.name);
                // ⚡ Use Universal Saver to persist definitions and progress
                await saveAchievementsToDb(game.id, data);
                updated++;
            } else {
                console.log('[IPC] No achievement data returned for:', game.title || game.name);
            }
            
            // Small delay to be polite to the upstream APIs and rate limits
            await new Promise(r => setTimeout(r, 500));
            
        } catch (e) {
            console.error(`[IPC] Failed to refresh achievements for ${game.title || game.name}:`, e.message);
        }
      }

      console.log(`[IPC] Global refresh complete. Processed: ${processed}, Updated: ${updated}`);
      return { success: true, processed, updated };
    } catch (error) {
      console.error('[IPC] Global refresh failed:', error);
      return { success: false, error: error.message };
    }
  });
}