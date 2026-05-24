
import { Notification } from 'electron';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import * as db from '../db/queries.js'; // Use the helper module which exports db instance too
import { resolvePath } from '../lib/pathUtils.js';
import { db as kysely } from '../db/client.js'; // Direct Kysely instance for specific queries
import { checkGameCompletion } from '../db/modules/achievements.js';
import { emitDataChange } from './DataChangeBus.js';

export class FileWatcherService {
  constructor() {
    this.watcher = null;
    this.window = null;
    
    // Track state of achievements to detect *new* unlocks
    this.lastStates = new Map(); // Map<filePath, Map<achievementId, unlockedAt>>
    
    // Manual overrides for specific files (Legacy/Manual Link)
    this.manualWatches = new Map(); // Map<filePath, { gameId, type }>
  }

  init(window) {
    this.window = window;
    this.reload();
  }

  /**
   * Reloads global watchers from the database.
   */
  async reload() {
    if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
    }

    // Initialize watcher with native Windows support
    this.watcher = chokidar.watch([], { 
      persistent: true, 
      ignoreInitial: true, // Don't scan on startup to prevent spam, rely on Manual Scan or updates
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      ignored: (filePath, stats) => {
          // 1. If stats aren't available yet, don't ignore (safe default)
          if (!stats) return false;
          
          // 2. Never ignore directories (must recurse to find files)
          if (stats.isDirectory()) return false;

          // 3. For files, check if they match our targets
          const name = path.basename(filePath).toLowerCase();
          const allowed = ['achievements.json', 'achievements.ini', 'steam_emu.ini'];
          
          return !allowed.includes(name);
      }
    });

    this.watcher.on('add', (p) => this.handleFileChange(p));
    this.watcher.on('change', (p) => this.handleFileChange(p));
    this.watcher.on('error', (err) => console.error(`[Watcher] Error:`, err));

    try {
        const watchPaths = await kysely.selectFrom('watch_paths').selectAll().execute();
        
        for (const wp of watchPaths) {
            if (!wp.path) continue;
            
            // 1. Resolve Environment Variables (e.g. %APPDATA% -> C:\Users\...)
            const expanded = resolvePath(wp.path);

            // 2. Watch the Directory Directly
            this.watcher.add(expanded);
            
            console.log(`[Watcher] 🔭 Watching directory (recursive): ${expanded}`);
        }
    } catch (e) {
        console.error('[Watcher] Failed to load watch paths:', e);
    }

    // Re-add manual watches
    for (const [filePath] of this.manualWatches) {
        this.watcher.add(filePath);
    }
  }

  /**
   * Manually crawls all watched paths to sync existing files.
   * ⚡ FORCE SYNC: Processes all found files regardless of cache state.
   */
  async scanAll() {
    console.log('[Watcher] Starting full manual scan...');
    const watchPaths = await kysely.selectFrom('watch_paths').selectAll().execute();
    
    let totalFilesFound = 0;
    const targetFiles = ['achievements.json', 'achievements.ini', 'steam_emu.ini'];

    for (const wp of watchPaths) {
      if (!wp.path) continue;
      
      const rootPath = resolvePath(wp.path); // Resolves %APPDATA%, etc.
      console.log(`[Watcher] Scanning directory: ${rootPath}`);

      try {
        // Recursively find all target files
        const files = await this.walkDirectory(rootPath, targetFiles);
        
        for (const filePath of files) {
          // ⚡ FORCE SYNC: Pass true to ignore memory cache and check DB
          await this.handleFileChange(filePath, true); 
          totalFilesFound++;
        }
      } catch (e) {
        console.error(`[Watcher] Failed to scan ${rootPath}:`, e);
      }
    }
    
    console.log(`[Watcher] Manual scan complete. Processed ${totalFilesFound} files.`);
    return { success: true, count: totalFilesFound };
  }

  /**
   * Recursive helper to find specific filenames.
   */
  async walkDirectory(dir, targetFileNames) {
    let results = [];
    try {
      const list = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursive dive
          const subResults = await this.walkDirectory(fullPath, targetFileNames);
          results = results.concat(subResults);
        } else if (targetFileNames.includes(entry.name.toLowerCase())) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore access errors (e.g. system folders)
    }
    return results;
  }

  /**
   * Manual watch for a specific file (Legacy IPC).
   */
  watch(gameId, filePath, type) {
    if (!filePath) return;
    this.manualWatches.set(filePath, { gameId, type });
    if (this.watcher) {
      this.watcher.add(filePath);
    }
  }

  unwatch(filePath) {
    this.manualWatches.delete(filePath);
    if (this.watcher) {
      this.watcher.unwatch(filePath);
    }
    this.lastStates.delete(filePath);
  }

  async handleFileChange(filePath, forceSync = false) {
    try {
        console.log(`[Watcher] 🔍 File changed detected: ${filePath}`);

        let gameId = null;
        let type = null;

        // A. Check Manual Overrides
        if (this.manualWatches.has(filePath)) {
            const config = this.manualWatches.get(filePath);
            gameId = config.gameId;
            type = config.type;
            console.log(`[Watcher] 🎯 Manual override matched for Game ID: ${gameId}`);
        } else {
            // B. Auto-Detect based on Filename and Folder
            const fileName = path.basename(filePath).toLowerCase();
            if (fileName === 'achievements.json') type = 'goldberg';
            else if (fileName === 'achievements.ini' || fileName === 'steam_emu.ini') type = 'codex';
            else {
                return;
            }

            // Extract AppID (Parent Folder Name)
            const parts = filePath.split(/[/\\]/);
            const potentialIds = parts.filter(p => /^\d+$/.test(p));
            const appId = potentialIds[potentialIds.length - 1]; // Grab the last numeric segment

            console.log(`[Watcher] 🆔 Extracted AppID: ${appId}`);

            if (!appId) {
                console.log(`[Watcher] ⚠️ Could not determine AppID from path.`);
                return;
            }

            // Find Game in DB
            const game = await kysely.selectFrom('games')
                .select(['id', 'name'])
                .where((eb) => eb.or([
                    eb('id', '=', appId),
                    eb('steam_id', '=', appId)
                ]))
                .executeTakeFirst();

            if (game) {
                gameId = game.id;
                console.log(`[Watcher] ✅ Match found: "${game.name}" (ID: ${game.id})`);
            } else {
                console.log(`[Watcher] ❌ No game found in library for AppID: ${appId}`);
                return;
            }
        }

        if (gameId && type) {
            await this.processFile(gameId, filePath, type, forceSync);
        }

    } catch (e) {
        console.error('[Watcher] Error handling file change:', e);
    }
  }

  /**
   * Helper to find a historical session that was active during a specific timestamp.
   */
  async findSessionForTimestamp(gameId, isoDateString) {
    if (!isoDateString) return null;
    const unlockTime = new Date(isoDateString).getTime();

    // Link to session active at that time
    // Condition: session started before unlock AND (ended after unlock OR is still open/active)
    return await kysely.selectFrom('sessions')
        .select('id')
        .where('game_id', '=', String(gameId))
        .where('start_time', '<=', unlockTime)
        .where((eb) => eb.or([
            eb('end_time', '>=', unlockTime),
            eb('end_time', '=', 0),     // Active in DB convention
            eb('end_time', 'is', null)  // Safety check
        ]))
        .orderBy('start_time', 'desc')
        .executeTakeFirst();
  }

  async processFile(gameId, filePath, type, forceSync = false) {
    if (!this.window) return;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      let currentUnlocks = [];

      if (type === 'goldberg') {
        currentUnlocks = this.parseGoldberg(content);
      } else {
        currentUnlocks = this.parseCodex(content);
      }

      // 1. Maintain Memory State (always needed for the watcher)
      if (!this.lastStates.has(filePath)) {
          this.lastStates.set(filePath, new Map());
      }
      const lastState = this.lastStates.get(filePath);

      // 2. Determine what to process
      let unlocksToProcess = [];

      if (forceSync) {
          // ⚡ FORCE SYNC: Check EVERYTHING in the file, ignoring memory cache
          // We will let the Database checks filter out duplicates later
          unlocksToProcess = currentUnlocks;
          console.log(`[Watcher] Force syncing ${unlocksToProcess.length} achievements for ${gameId}`);
      } else {
          // NORMAL WATCHER: Only process items that are NEW since last read
          unlocksToProcess = currentUnlocks.filter(u => !lastState.has(u.id));
          
          // If this is the VERY first read and NOT a force sync, 
          // we usually return early to avoid notification spam.
          if (lastState.size === 0 && currentUnlocks.length > 0) {
               // Just update cache and exit
               currentUnlocks.forEach(u => lastState.set(u.id, u.unlockedAt));
               return; 
          }
      }

      // Update Cache
      currentUnlocks.forEach(u => lastState.set(u.id, u.unlockedAt));

      if (unlocksToProcess.length > 0) {
        console.log(`[Watcher] Processing ${unlocksToProcess.length} potential achievements for Game ${gameId}`);
        
        const processedUnlocks = []; // Track what we actually unlock

        // Fetch settings once
        const toastSetting = await db.getSetting('achievement_toast');
        const soundSetting = await db.getSetting('achievement_sound');
        const showToast = toastSetting !== false;
        const playSound = soundSetting === true || soundSetting === 1;
        
        for (const unlock of unlocksToProcess) {
            // 1. Check current DB status
            const existing = await kysely.selectFrom('achievements')
                .select(['id', 'unlocked'])
                .where('id', '=', unlock.id)
                .where('game_id', '=', gameId)
                .executeTakeFirst();

            // ⚡ CRITICAL CHECK: If already unlocked in DB, skip completely
            if (existing && existing.unlocked === 1) {
                continue;
            }

            // 2. Update or Create Achievement Record (Set unlocked = 1)
            if (!existing) {
                // Create Stub if missing
                await kysely.insertInto('achievements').values({
                    id: unlock.id,
                    game_id: gameId,
                    name: unlock.id, 
                    description: 'Unlocked via File Watcher',
                    is_hidden: 0,
                    unlocked: 1 // Mark unlocked immediately
                }).execute();
            } else {
                // Update existing locked record
                await kysely.updateTable('achievements')
                    .set({ unlocked: 1 })
                    .where('id', '=', unlock.id)
                    .where('game_id', '=', gameId)
                    .execute();
            }

            // 3. Determine Session to Link
            let sessionId = null;
            if (forceSync) {
                // MANUAL SCAN: Search history for the session that was active when this unlocked
                const historical = await this.findSessionForTimestamp(gameId, unlock.unlockedAt);
                if (historical) sessionId = historical.id;
            } else {
                // LIVE WATCHER: Only link to the currently open session
                const active = await db.getOpenSession(gameId);
                if (active) sessionId = active.id;
            }

            // 4. Save Detailed Progress (Session/Timestamp)
            await db.saveAchievementProgress(gameId, unlock.id, {
                unlocked_at: unlock.unlockedAt,
                session_id: sessionId
            });

            processedUnlocks.push(unlock);

            // 5. Notifications
            try {
                const details = await db.getAchievementById(gameId, unlock.id);
                if (details) {
                    if (showToast) {
                        const iconPath = path.join(process.cwd(), 'public', 'images', 'trophy.png');
                        new Notification({
                            title: 'Achievement Unlocked',
                            body: details.name,
                            silent: true, 
                            icon: iconPath
                        }).show();
                    }

                    if (playSound) {
                        this.window.webContents.send('play-sound', 'achievement');
                    }
                }
            } catch (e) {
                console.error('[Watcher] Notification failed:', e);
            }
        }

        // Send IPC update if we processed anything
        if (processedUnlocks.length > 0) {
            const currentActive = await db.getOpenSession(gameId);
            this.window.webContents.send('achievement:unlocked', {
                gameId: gameId,
                newUnlocks: processedUnlocks,
                allUnlockedCount: currentUnlocks.length,
                filePath,
                type: type,
                sessionId: currentActive ? currentActive.id : null,
                timestamp: Date.now()
            });
            emitDataChange({
                type: 'achievement',
                source: forceSync ? 'achievements:scan' : 'achievement-watcher',
                gameId,
                ids: processedUnlocks.map(u => u.id),
                important: true
            });

            // 6. ⚡ AUTOMATION: Check for 100% Completion
            // If the game is now fully unlocked, promote it to 'Completed'
            const isComplete = await checkGameCompletion(gameId);
            if (isComplete) {
                this.window.webContents.send('ACHIEVEMENT_100_PERCENT', { gameId });
                new Notification({
                    title: '100% Completion!',
                    body: 'Game status promoted to Completed.',
                    silent: false
                }).show();
            }
        }
      }
    } catch (err) {
      console.error(`[Watcher] Error parsing ${filePath}:`, err);
    }
  }

  parseGoldberg(content) {
    try {
      const data = JSON.parse(content);
      return Object.entries(data)
        .filter(([_, stats]) => {
          // Check all known keys for "unlocked" status
          return stats.earned === true || 
                 stats.completed === true || 
                 stats.unlocked === true;
        })
        .map(([id, stats]) => {
          // Check all known keys for timestamp
          // Note: stats.time is sometimes used by generic emulators
          const timeRaw = stats.earned_time || stats.unlock_time || stats.time || 0;
          
          return {
            id,
            unlockedAt: timeRaw > 0 
              ? new Date(timeRaw * 1000).toISOString() 
              : new Date().toISOString()
          };
        });
    } catch (e) {
      console.warn('[Watcher] Goldberg JSON Parse Error:', e);
      return [];
    }
  }

  parseCodex(content) {
    const unlocks = [];
    let inAchievementsSection = false;
    const now = new Date().toISOString(); 
    // Note: Codex .ini usually does NOT store timestamps, so we default to 'now'.
    
    try {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

        // Detect Section
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const section = trimmed.toLowerCase();
            // Support [Achievements], [SteamAchievements], etc.
            inAchievementsSection = section.includes('achievements');
            continue;
        }

        if (inAchievementsSection && trimmed.includes('=')) {
          const [id, valueRaw] = trimmed.split('=').map(s => s.trim());
          if (!valueRaw) continue;
          
          const val = valueRaw.toLowerCase();
          
          // Check for any "truthy" value found in various INI formats
          if (val === '1' || val === 'true' || val === 'yes' || val === 'on') {
            unlocks.push({ id, unlockedAt: now });
          }
        }
      }
    } catch (e) {
       console.warn('[Watcher] Codex INI Parse Error:', e);
    }
    
    return unlocks;
  }
}

export const achievementWatcher = new FileWatcherService();
