import achievementOrchestrator from './AchievementOrchestrator.js';
import { getGameById } from '../db/modules/games.js';
import { getLinkedAccounts } from '../db/modules/settings.js';
import { getSetting, setSetting } from '../db/modules/settings.js';
import { saveAchievementsToDb, getAchievementById } from '../db/modules/achievements.js';
import { emitDataChange } from './DataChangeBus.js';
import { sessionLifecycle } from './SessionLifecycleService.js';
import { retryDelayMs } from './SteamAutoSyncUtils.js';

export const STEAM_AUTO_SYNC_SETTING = 'steam_auto_achievement_sync_enabled';
export const STEAM_AUTO_SYNC_INTERVAL = 15 * 60 * 1000;

export class SteamAutoAchievementSyncService {
  constructor(deps = {}) {
    this.deps = {
      orchestrator: achievementOrchestrator,
      getGameById,
      getLinkedAccounts,
      getSetting,
      setSetting,
      saveAchievementsToDb,
      getAchievementById,
      emitDataChange,
      ...deps
    };
    this.enabled = false;
    this.window = null;
    this.inFlight = new Map();
    this.controllers = new Map();
    this.lastRun = new Map();
    this.failures = new Map();
    this.baselined = new Set();
    this.sessionTimers = new Map();
    this.stopped = false;
    this.onStarted = (session) => this.sessionStarted(session);
    this.onEnded = (session) => this.sessionEnded(session);
  }

  async init(window) {
    this.window = window;
    this.stopped = false;
    this.enabled = (await this.deps.getSetting(STEAM_AUTO_SYNC_SETTING)) === true;
    sessionLifecycle.off('started', this.onStarted);
    sessionLifecycle.off('ended', this.onEnded);
    sessionLifecycle.on('started', this.onStarted);
    sessionLifecycle.on('ended', this.onEnded);
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled === true;
    if (!this.enabled) this.clearTimers();
  }

  clearTimers() {
    for (const timer of this.sessionTimers.values()) clearTimeout(timer);
    this.sessionTimers.clear();
  }

  stop() {
    this.stopped = true;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.clearTimers();
    sessionLifecycle.off('started', this.onStarted);
    sessionLifecycle.off('ended', this.onEnded);
  }

  sessionStarted(session) {
    if (!this.enabled || this.stopped) return;
    this.syncGame(session.gameId, { reason: 'session-start', silentBaseline: true }).catch(() => {});
    this.scheduleSessionPoll(session.gameId);
  }

  sessionEnded(session) {
    const timer = this.sessionTimers.get(String(session.gameId));
    if (timer) clearTimeout(timer);
    this.sessionTimers.delete(String(session.gameId));
    if (this.enabled && !this.stopped) {
      this.syncGame(session.gameId, { reason: 'session-end', force: true }).catch(() => {});
    }
  }

  scheduleSessionPoll(gameId) {
    const key = String(gameId);
    const previous = this.sessionTimers.get(key);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(async () => {
      this.sessionTimers.delete(key);
      if (!this.enabled || this.stopped) return;
      await this.syncGame(gameId, { reason: 'session-poll' }).catch(() => {});
      this.scheduleSessionPoll(gameId);
    }, STEAM_AUTO_SYNC_INTERVAL);
    timer.unref?.();
    this.sessionTimers.set(key, timer);
  }

  async syncGame(gameId, options = {}) {
    const game = await this.deps.getGameById(String(gameId));
    if (!game) return { success: false, status: 'skipped', reason: 'game_not_found' };
    if (!game.steam_id || game.steam_id === 'undefined') {
      return { success: false, status: 'skipped', reason: 'missing_steam_id' };
    }

    const accounts = await this.deps.getLinkedAccounts('steam');
    const accountId = accounts?.[0]?.external_id;
    if (!accountId) return { success: false, status: 'skipped', reason: 'unlinked_account' };

    const key = `${accountId}:${game.id}`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const now = Date.now();
    const failure = this.failures.get(key);
    if (!options.force && failure && now < failure.retryAt) {
      return { success: false, status: 'backoff', retryAt: failure.retryAt };
    }
    if (!options.force && now - (this.lastRun.get(key) || 0) < 60_000) {
      return { success: true, status: 'cooldown' };
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);
    const task = this.runSync(game, accountId, key, { ...options, signal: controller.signal }).finally(() => {
      this.inFlight.delete(key);
      this.controllers.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  async runSync(game, accountId, key, options) {
    this.lastRun.set(key, Date.now());
    const snapshot = await this.deps.orchestrator.fetchSteamSnapshot(game, accountId, options.signal);
    if (snapshot.status !== 'complete' && snapshot.status !== 'no-achievements') {
      if (snapshot.retryable) {
        const attempts = (this.failures.get(key)?.attempts || 0) + 1;
        this.failures.set(key, { attempts, retryAt: Date.now() + retryDelayMs(attempts) });
      }
      await this.recordStatus(game.id, snapshot.status, snapshot.reason || null);
      return { success: false, ...snapshot };
    }

    this.failures.delete(key);
    const stats = snapshot.achievements.length
      ? await this.deps.saveAchievementsToDb(game.id, snapshot.achievements, {
          mode: 'full',
          definitionsComplete: snapshot.definitionsComplete,
          associateSessions: true
        })
      : { total: 0, newlyUnlocked: 0, newlyUnlockedIds: [], definitionsUpdated: 0 };

    const isBaseline = !this.baselined.has(key);
    this.baselined.add(key);
    const notify = !(options.silentBaseline && isBaseline);
    if (notify && stats.newlyUnlockedIds.length) {
      const details = await Promise.all(stats.newlyUnlockedIds.map(async (id) => ({
        id,
        ...(await this.deps.getAchievementById(game.id, id))
      })));
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('achievement:unlocked', {
          gameId: String(game.id),
          newUnlocks: details,
          source: 'steam-auto-sync',
          timestamp: Date.now()
        });
      }
    }

    if (stats.newlyUnlockedIds.length || stats.definitionsUpdated) {
      this.deps.emitDataChange({
        type: 'achievement',
        source: options.reason === 'manual' ? 'achievements:refresh-game' : 'steam-auto-sync',
        gameId: game.id,
        ids: stats.newlyUnlockedIds,
        important: stats.newlyUnlockedIds.length > 0
      });
    }
    await this.recordStatus(game.id, snapshot.status, null);
    return { success: true, status: snapshot.status, ...stats, baseline: isBaseline };
  }

  async recordStatus(gameId, status, error) {
    await this.deps.setSetting('steam_auto_achievement_last_status', {
      gameId: String(gameId), status, error, at: Date.now()
    });
  }
}

export const steamAutoAchievementSync = new SteamAutoAchievementSyncService();
