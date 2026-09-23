import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const BACKUP_FILE = /^valis-(\d{4}-\d{2}-\d{2})\.db$/;
const REQUIRED_COLUMNS = {
  games: ['id', 'name'],
  library: ['game_id', 'status'],
  sessions: ['id', 'game_id', 'start_time', 'end_time'],
  achievements: ['id', 'game_id', 'name'],
  achievement_progress: ['game_id', 'achievement_id', 'unlocked_at'],
  settings: ['key', 'value'],
  linked_accounts: ['id', 'platform', 'external_id'],
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

export function validateDatabaseFile(filePath) {
  const file = fs.lstatSync(filePath);
  if (!file.isFile() || file.isSymbolicLink()) throw new Error('Backup must be a regular database file');
  const snapshot = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const check = snapshot.pragma('integrity_check');
    if (check.length !== 1 || check[0].integrity_check !== 'ok') {
      throw new Error('SQLite integrity check failed');
    }
    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
      const present = new Set(snapshot.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
      if (required.some((column) => !present.has(column))) {
        throw new Error(`Database schema is missing required columns in ${table}`);
      }
    }
    return true;
  } finally {
    snapshot.close();
  }
}

export class LocalBackupService {
  constructor({ rawDb, userDataPath, clock = () => new Date(), timers = globalThis, powerMonitor = null }) {
    this.rawDb = rawDb;
    this.directory = path.join(userDataPath, 'backups');
    this.quarantineDirectory = path.join(userDataPath, 'backup-quarantine');
    this.clock = clock;
    this.timers = timers;
    this.powerMonitor = powerMonitor;
    this.inFlight = null;
    this.timer = null;
    this.lastResult = null;
    this.running = false;
    this.validatedFiles = new Map();
    this.onResume = () => {
      void this.runIfDue();
      this.scheduleNext();
    };
  }

  getBackupPath(dateKey) {
    if (!isValidDateKey(dateKey)) throw new Error('Invalid backup date');
    return path.join(this.directory, `valis-${dateKey}.db`);
  }

  list() {
    fs.mkdirSync(this.directory, { recursive: true });
    const files = fs.readdirSync(this.directory)
      .map((name) => ({ name, match: BACKUP_FILE.exec(name) }))
      .filter(({ match }) => match && isValidDateKey(match[1]))
      .map(({ name, match }) => {
        const filePath = path.join(this.directory, name);
        const stat = fs.lstatSync(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          this.quarantine(filePath);
          return null;
        }
        const fingerprint = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
        if (this.validatedFiles.get(filePath) !== fingerprint) {
          try { validateDatabaseFile(filePath); }
          catch { this.quarantine(filePath); return null; }
          this.validatedFiles.set(filePath, fingerprint);
        }
        return { dateKey: match[1], size: stat.size, createdAt: stat.birthtimeMs };
      })
      .filter(Boolean)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return { files, directory: this.directory, lastResult: this.lastResult };
  }

  async runIfDue() {
    if (this.inFlight) return this.inFlight;
    const dateKey = localDateKey(this.clock());
    try {
      if (this.list().files.some((file) => file.dateKey === dateKey)) {
        return { success: true, status: 'already-backed-up', dateKey };
      }
    } catch (error) {
      this.lastResult = { success: false, status: 'error', dateKey, at: Date.now(), error: error.message };
      return this.lastResult;
    }
    this.inFlight = this.createBackup(dateKey).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async createBackup(dateKey) {
    fs.mkdirSync(this.directory, { recursive: true });
    const target = this.getBackupPath(dateKey);
    const temp = path.join(this.directory, `.valis-${dateKey}-${process.pid}-${crypto.randomUUID()}.tmp`);
    try {
      await this.rawDb.backup(temp);
      const standalone = new Database(temp);
      try { standalone.pragma('journal_mode = DELETE'); }
      finally { standalone.close(); }
      validateDatabaseFile(temp);
      // A completed daily file is immutable; a second trigger only observes it.
      if (fs.existsSync(target)) this.quarantine(target);
      fs.renameSync(temp, target);
      this.prune();
      this.lastResult = { success: true, status: 'created', dateKey, at: Date.now() };
      return this.lastResult;
    } catch (error) {
      this.lastResult = { success: false, status: 'error', dateKey, at: Date.now(), error: error.message };
      return this.lastResult;
    } finally {
      if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
    }
  }

  prune() {
    const files = this.list().files;
    for (const file of files.slice(7)) {
      fs.rmSync(this.getBackupPath(file.dateKey));
    }
  }

  quarantine(filePath) {
    fs.mkdirSync(this.quarantineDirectory, { recursive: true });
    const destination = path.join(this.quarantineDirectory, `${path.basename(filePath)}.${Date.now()}.${crypto.randomUUID()}`);
    fs.renameSync(filePath, destination);
    this.validatedFiles.delete(filePath);
  }

  scheduleNext() {
    if (this.timer) this.timers.clearTimeout(this.timer);
    if (!this.running) return;
    const now = this.clock();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    this.timer = this.timers.setTimeout(() => {
      void this.runIfDue().finally(() => this.scheduleNext());
    }, next.getTime() - now.getTime());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.powerMonitor?.on('resume', this.onResume);
    this.scheduleNext();
    void this.runIfDue();
  }

  stop() {
    this.running = false;
    if (this.timer) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.powerMonitor?.off('resume', this.onResume);
  }
}
