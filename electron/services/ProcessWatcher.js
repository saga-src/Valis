import { app } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import * as db from '../db/queries.js';
import { sessionLifecycle } from './SessionLifecycleService.js';
import { calculateScanStats, groupTargetsByExecutable, sanitizeWatcherInterval } from './ProcessWatcherUtils.js';

const getBinaryPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'bin', 'fastlist.exe')
  : path.join(app.getAppPath(), 'resources', 'bin', 'fastlist.exe');

export function getProcessList({ spawnProcess = spawn, timeoutMs = 10_000 } = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawnProcess(getBinaryPath(), [], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };
    const timeout = setTimeout(() => {
      child.kill?.();
      finish({ ok: false, processes: [], error: 'scan_timeout' });
    }, timeoutMs);
    timeout.unref?.();

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => finish({ ok: false, processes: [], error: error.message }));
    child.on('close', (code) => {
      if (code !== 0 || stderr.trim()) {
        finish({ ok: false, processes: [], error: stderr.trim() || `fastlist_exit_${code}` });
        return;
      }
      const lineRegex = /^\s*(\d+)\s+(\d+)\s+(.+)$/;
      const processes = stdout.trim().split(/\r?\n/).flatMap((line) => {
        const match = line.trim().match(lineRegex);
        return match ? [{ pid: Number(match[1]), name: match[3].trim() }] : [];
      });
      finish({ ok: true, processes });
    });
  });
}

export class GameWatcher {
  constructor(deps = {}) {
    this.deps = { db, scanProcesses: getProcessList, now: () => Date.now(), ...deps };
    this.activeSessions = new Map();
    this.launchHints = new Map();
    this.isRunning = false;
    this.window = null;
    this.timer = null;
    this.generation = 0;
    this.scanInProgress = false;
    this.interval = 5000;
    this.targetCache = null;
    this.targetCacheAt = 0;
    this.health = { scans: 0, failures: 0, overlapsPrevented: 0, targetQueries: 0, samples: [] };
  }

  start(window, interval = 5000) {
    this.stop({ preserveSessions: true });
    this.window = window;
    this.interval = sanitizeWatcherInterval(interval);
    this.isRunning = true;
    const generation = ++this.generation;
    this.schedule(0, generation);
    return this.getHealth();
  }

  stop({ preserveSessions = true } = {}) {
    this.isRunning = false;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!preserveSessions) this.activeSessions.clear();
  }

  invalidateTargets() {
    this.targetCache = null;
    this.targetCacheAt = 0;
  }

  addLaunchHint({ gameId, pid, executable, startedAt = Date.now() }) {
    this.launchHints.set(String(gameId), { pid, executable, startedAt, expiresAt: startedAt + 2 * 60_000 });
    this.invalidateTargets();
  }

  schedule(delay, generation) {
    if (!this.isRunning || generation !== this.generation) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(generation), delay);
    this.timer.unref?.();
  }

  async tick(generation) {
    if (!this.isRunning || generation !== this.generation) return;
    if (this.scanInProgress) {
      this.health.overlapsPrevented++;
      this.schedule(this.interval, generation);
      return;
    }
    this.scanInProgress = true;
    try {
      await this.check(generation);
    } finally {
      this.scanInProgress = false;
      this.schedule(this.interval, generation);
    }
  }

  async getTargets() {
    const now = this.deps.now();
    if (this.targetCache && now - this.targetCacheAt < 30_000) return this.targetCache;
    this.health.targetQueries++;
    this.targetCache = await this.deps.db.getGamesWithExecutables();
    this.targetCacheAt = now;
    return this.targetCache;
  }

  async check(generation) {
    const trackableGames = await this.getTargets();
    if (generation !== undefined && (!this.isRunning || generation !== this.generation)) return;
    if (!trackableGames.length && !this.activeSessions.size) return;
    const result = await this.deps.scanProcesses();
    if (generation !== undefined && (!this.isRunning || generation !== this.generation)) return;
    this.health.scans++;
    this.health.samples.push(result.durationMs || 0);
    if (this.health.samples.length > 120) this.health.samples.shift();
    if (!result.ok) {
      this.health.failures++;
      return;
    }

    const now = this.deps.now();
    for (const [id, hint] of this.launchHints) if (hint.expiresAt <= now) this.launchHints.delete(id);
    const processByName = new Map();
    for (const processInfo of result.processes) {
      const name = processInfo.name.toLowerCase();
      const items = processByName.get(name) || [];
      items.push(processInfo);
      processByName.set(name, items);
    }

    for (const [gameId, session] of this.activeSessions) {
      const matches = processByName.get(path.basename(session.executable).toLowerCase()) || [];
      const running = session.pid ? matches.some((item) => item.pid === session.pid) : matches.length > 0;
      session.missingScans = running ? 0 : (session.missingScans || 0) + 1;
      if (session.missingScans >= 2) await this.endSession(gameId);
    }

    const grouped = groupTargetsByExecutable(trackableGames);
    for (const [basename, games] of grouped) {
      const processes = processByName.get(basename) || [];
      if (!processes.length) continue;
      if (games.length > 1) {
        for (const game of games) {
          const hint = this.launchHints.get(String(game.id));
          if (hint && processes.some((item) => item.pid === hint.pid) && !this.activeSessions.has(String(game.id))) {
            await this.startSession(game, hint.pid);
          }
        }
        continue;
      }
      const game = games[0];
      if (!this.activeSessions.has(String(game.id))) {
        await this.startSession(game, null);
      }
    }
  }

  async startSession(game, pid = null) {
    const gameId = String(game.id);
    const existing = await this.deps.db.getOpenSession(gameId);
    const startTime = existing?.start_time || this.deps.now();
    const sessionId = existing?.id || await this.deps.db.createSession(gameId, startTime);
    const session = { id: sessionId, gameId, title: game.title || game.name, executable: game.executable, startTime, pid, missingScans: 0 };
    this.activeSessions.set(gameId, session);
    sessionLifecycle.sessionStarted(session);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('watcher:session-started', { gameId, startTime, sessionId });
    }
  }

  async endSession(gameId) {
    const key = String(gameId);
    const session = this.activeSessions.get(key);
    if (!session) return;
    const endTime = this.deps.now();
    const ended = await this.deps.db.endSession(session.id, endTime);
    this.activeSessions.delete(key);
    const durationSeconds = Math.max(0, Math.round((endTime - session.startTime) / 1000));
    const event = { ...session, endTime, durationSeconds, persisted: ended };
    sessionLifecycle.sessionEnded(event);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('watcher:session-ended', { gameId: key, duration: durationSeconds });
    }
  }

  getHealth() {
    const timing = calculateScanStats(this.health.samples);
    return {
      enabled: this.isRunning,
      interval: this.interval,
      loopsActive: this.timer ? 1 : 0,
      scans: this.health.scans,
      failures: this.health.failures,
      overlapsPrevented: this.health.overlapsPrevented,
      targetQueries: this.health.targetQueries,
      ...timing
    };
  }
}

export const gameWatcher = new GameWatcher();
