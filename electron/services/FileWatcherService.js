import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import * as db from '../db/queries.js';
import { resolvePath } from '../lib/pathUtils.js';
import { db as kysely } from '../db/client.js';
import { saveAchievementsToDb } from '../db/modules/achievements.js';
import { emitDataChange } from './DataChangeBus.js';
import { parseCodexAchievements, parseGoldbergAchievements } from './LocalAchievementParsers.js';

export class FileWatcherService {
  constructor(deps = {}) {
    this.deps = { fs, db, kysely, createWatcher: (options) => chokidar.watch([], options), ...deps };
    this.watcher = null;
    this.window = null;
    this.lastStates = new Map();
    this.manualWatches = new Map();
    this.fileLocks = new Map();
    this.generation = 0;
  }

  canonicalPath(filePath) {
    const resolved = path.normalize(path.resolve(resolvePath(filePath)));
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  init(window) {
    this.window = window;
    return this.reload();
  }

  async close() {
    this.generation++;
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
  }

  async reload() {
    await this.close();
    const generation = this.generation;
    this.watcher = this.deps.createWatcher({
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 750, pollInterval: 100 },
      ignored: (filePath, stats) => {
        if (!stats || stats.isDirectory()) return false;
        return !['achievements.json', 'achievements.ini', 'steam_emu.ini'].includes(path.basename(filePath).toLowerCase());
      }
    });
    this.watcher.on('add', (filePath) => this.handleFileChange(filePath));
    this.watcher.on('change', (filePath) => this.handleFileChange(filePath));
    this.watcher.on('error', (error) => console.error('[AchievementWatcher] Watch error:', error.message));

    const watchPaths = await this.deps.kysely.selectFrom('watch_paths').selectAll().execute();
    for (const row of watchPaths) if (row.path) this.watcher.add(this.canonicalPath(row.path));
    for (const filePath of this.manualWatches.keys()) this.watcher.add(filePath);
    void this.scanAll(generation).catch((error) => console.warn('[AchievementWatcher] Baseline scan failed:', error.message));
  }

  watch(gameId, filePath, type) {
    if (!filePath) return;
    const canonical = this.canonicalPath(filePath);
    this.manualWatches.set(canonical, { gameId: String(gameId), type });
    this.watcher?.add(canonical);
  }

  unwatch(filePath) {
    const canonical = this.canonicalPath(filePath);
    this.manualWatches.delete(canonical);
    this.lastStates.delete(canonical);
    this.watcher?.unwatch(canonical);
  }

  async scanAll(expectedGeneration = null) {
    const watchPaths = await this.deps.kysely.selectFrom('watch_paths').selectAll().execute();
    let count = 0;
    for (const row of watchPaths) {
      if (expectedGeneration !== null && expectedGeneration !== this.generation) {
        return { success: false, cancelled: true, count };
      }
      if (!row.path) continue;
      const files = await this.walkDirectory(this.canonicalPath(row.path));
      for (const filePath of files) {
        if (expectedGeneration !== null && expectedGeneration !== this.generation) {
          return { success: false, cancelled: true, count };
        }
        await this.handleFileChange(filePath, true);
        count++;
      }
    }
    return { success: true, count };
  }

  async walkDirectory(directory) {
    const results = [];
    try {
      for (const entry of await this.deps.fs.readdir(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) results.push(...await this.walkDirectory(fullPath));
        else if (['achievements.json', 'achievements.ini', 'steam_emu.ini'].includes(entry.name.toLowerCase())) results.push(fullPath);
      }
    } catch {
      // Inaccessible emulator/system directories are skipped individually.
    }
    return results;
  }

  async handleFileChange(filePath, forceSync = false) {
    const canonical = this.canonicalPath(filePath);
    const previous = this.fileLocks.get(canonical) || Promise.resolve();
    const task = previous.catch(() => {}).then(() => this.handleFileChangeLocked(canonical, forceSync));
    this.fileLocks.set(canonical, task);
    try {
      return await task;
    } finally {
      if (this.fileLocks.get(canonical) === task) this.fileLocks.delete(canonical);
    }
  }

  async resolveTarget(filePath) {
    const manual = this.manualWatches.get(filePath);
    if (manual) return manual;
    const fileName = path.basename(filePath).toLowerCase();
    const type = fileName === 'achievements.json' ? 'goldberg'
      : ['achievements.ini', 'steam_emu.ini'].includes(fileName) ? 'codex' : null;
    if (!type) return null;
    const appId = filePath.split(/[/\\]/).filter((part) => /^\d+$/.test(part)).at(-1);
    if (!appId) return null;
    const games = await this.deps.kysely.selectFrom('games')
      .innerJoin('library', 'library.game_id', 'games.id')
      .select(['games.id'])
      .where((eb) => eb.or([eb('games.id', '=', appId), eb('games.steam_id', '=', appId)]))
      .limit(2)
      .execute();
    if (games.length !== 1) {
      if (games.length > 1) console.warn(`[AchievementWatcher] Ambiguous AppID ${appId}; file ignored.`);
      return null;
    }
    return { gameId: String(games[0].id), type };
  }

  async readStableFile(filePath, attempts = 4) {
    let previous = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const content = await this.deps.fs.readFile(filePath, 'utf8');
      if (content === previous) return content;
      previous = content;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
    return previous;
  }

  async handleFileChangeLocked(filePath, forceSync) {
    const target = await this.resolveTarget(filePath);
    if (!target || !this.window) return { success: false, reason: 'unresolved_target' };
    try {
      const content = await this.readStableFile(filePath);
      const current = target.type === 'goldberg' ? parseGoldbergAchievements(content) : parseCodexAchievements(content);
      const isBaseline = !this.lastStates.has(filePath);
      const previous = this.lastStates.get(filePath) || new Map();
      const candidates = forceSync ? current : current.filter((item) => !previous.has(item.id));
      this.lastStates.set(filePath, new Map(current.map((item) => [item.id, item.unlockedAt])));
      if (!candidates.length) return { success: true, newlyUnlocked: 0, baseline: isBaseline };

      const achievements = [];
      for (const unlock of candidates) {
        const definition = await this.deps.kysely.selectFrom('achievements')
          .select(['name', 'description', 'icon_url', 'is_hidden'])
          .where('game_id', '=', target.gameId)
          .where('id', '=', unlock.id)
          .executeTakeFirst();
        achievements.push({
          id: unlock.id,
          name: definition?.name || unlock.id,
          description: definition?.description || 'Unlocked via local achievement file',
          icon: definition?.icon_url || '',
          is_hidden: Boolean(definition?.is_hidden),
          unlocked: true,
          unlocked_at: unlock.unlockedAt
        });
      }

      const stats = await saveAchievementsToDb(target.gameId, achievements, {
        mode: 'full', definitionsComplete: false, associateSessions: true
      });
      const committed = candidates.filter((item) => stats.newlyUnlockedIds.includes(String(item.id)));
      if (committed.length) {
        if (!isBaseline && !forceSync) {
          this.window.webContents.send('achievement:unlocked', {
            gameId: target.gameId, newUnlocks: committed, filePath, type: target.type, timestamp: Date.now()
          });
        }
        emitDataChange({
          type: 'achievement', source: forceSync ? 'achievements:scan' : 'achievement-watcher',
          gameId: target.gameId, ids: stats.newlyUnlockedIds, important: true
        });
      }
      return { success: true, newlyUnlocked: committed.length, baseline: isBaseline };
    } catch (error) {
      console.warn(`[AchievementWatcher] Stable parse failed for ${filePath}: ${error.message}`);
      return { success: false, reason: 'invalid_or_partial_file', error: error.message };
    }
  }

}

export const achievementWatcher = new FileWatcherService();
