import { ipcMain } from 'electron';
import { achievementWatcher } from '../services/FileWatcherService.js';
import * as db from '../db/queries.js';
import { saveAchievementsToDb } from '../db/modules/achievements.js';
import { getLibrary } from '../db/modules/games.js';
import achievementOrchestrator from '../services/AchievementOrchestrator.js';
import { getLinkedAccounts } from '../db/modules/settings.js';
import { emitDataChange } from '../services/DataChangeBus.js';

const hasValue = (value) => value !== undefined && value !== null && String(value) !== '' && String(value) !== 'undefined' && String(value) !== 'null';

const countUnlocked = (achievements) => achievements.filter(a => a.unlockedAt || a.defaultUnlocked).length;

async function resolveAchievementPlatform(game, requested = 'auto') {
  const candidates = [];
  if (hasValue(game.steam_id)) candidates.push('steam');
  if (hasValue(game.xbox_market_id) || hasValue(game.xbox_store_id)) candidates.push('xbox');
  if (hasValue(game.psn_trophy_id) || hasValue(game.psn_id)) candidates.push('psn');
  if (hasValue(game.epic_id)) candidates.push('epic');

  const platform = requested && requested !== 'auto' ? requested : candidates[0];
  if (!platform) {
    return { unsupported: true, error: 'No supported achievement platform ID is available for this game.' };
  }

  if (platform === 'epic') {
    return { unsupported: true, platform, error: 'Epic per-game achievement sync is not available yet. Use the full Epic sync from Settings.' };
  }

  if (!candidates.includes(platform)) {
    return { unsupported: true, platform, error: `This game does not have a ${platform.toUpperCase()} achievement ID.` };
  }

  const accounts = await getLinkedAccounts(platform);
  if (!accounts || accounts.length === 0) {
    return { unsupported: true, platform, error: `Link a ${platform.toUpperCase()} account in Settings before syncing this game.` };
  }

  const routedGame = { ...game };
  if (platform !== 'steam') routedGame.steam_id = null;
  if (platform !== 'xbox') {
    routedGame.xbox_market_id = null;
    routedGame.xbox_store_id = null;
  }
  if (platform !== 'psn') {
    routedGame.psn_trophy_id = null;
    routedGame.psn_id = null;
  }

  return { platform, routedGame };
}

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
                const stats = await saveAchievementsToDb(game.id, data, { mode: 'lockedOnly' });
                emitDataChange({
                    type: 'achievement',
                    source: 'achievements:refresh-metadata',
                    gameId: game.id,
                    important: stats.newlyUnlocked > 0 || stats.definitionsUpdated > 0
                });
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

  /**
   * Refresh achievements for one game only.
   */
  ipcMain.handle('achievements:refresh-game', async (event, payload = {}) => {
    const gameId = String(payload.gameId || '');
    const mode = payload.mode || 'lockedOnly';
    const requestedPlatform = payload.platform || 'auto';

    try {
      if (!gameId) {
        return { success: false, gameId, unsupported: true, error: 'Missing gameId.' };
      }

      const game = await db.getGameById(gameId);
      if (!game) {
        return { success: false, gameId, unsupported: true, error: 'Game not found.' };
      }

      const platformResolution = await resolveAchievementPlatform(game, requestedPlatform);
      if (platformResolution.unsupported) {
        return {
          success: false,
          gameId,
          platform: platformResolution.platform,
          unsupported: true,
          error: platformResolution.error
        };
      }

      const platform = platformResolution.platform;
      event.sender.send('achievements:game-refresh-progress', {
        gameId,
        stage: 'fetching',
        message: `Fetching ${platform.toUpperCase()} achievements...`
      });

      const before = await db.getAchievements(gameId);
      const unlockedBefore = countUnlocked(before);
      const data = await achievementOrchestrator.fetchAchievements(platformResolution.routedGame);

      if (!data || data.length === 0) {
        return {
          success: false,
          gameId,
          platform,
          unsupported: true,
          error: 'No achievement data was returned for this game.'
        };
      }

      event.sender.send('achievements:game-refresh-progress', {
        gameId,
        stage: 'saving',
        message: `Saving ${data.length} achievements...`
      });

      const stats = await saveAchievementsToDb(gameId, data, { mode });
      const after = await db.getAchievements(gameId);
      const unlockedAfter = countUnlocked(after);
      const newlyUnlocked = Math.max(0, unlockedAfter - unlockedBefore);

      emitDataChange({
        type: 'achievement',
        source: 'achievements:refresh-game',
        gameId,
        important: newlyUnlocked > 0 || stats.definitionsUpdated > 0
      });

      event.sender.send('achievements:game-refresh-progress', {
        gameId,
        stage: 'done',
        message: 'Achievement sync complete.'
      });

      return {
        success: true,
        gameId,
        platform,
        total: stats.total,
        unlockedBefore,
        unlockedAfter,
        newlyUnlocked,
        definitionsUpdated: stats.definitionsUpdated
      };
    } catch (error) {
      console.error('[IPC] achievements:refresh-game failed:', error);
      return { success: false, gameId, error: error.message };
    }
  });
}
