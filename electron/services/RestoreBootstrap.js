import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { isValidDateKey, validateDatabaseFile } from './LocalBackupService.js';

const VERSION = 1;

export function restorePaths(userDataPath) {
  const directory = path.join(userDataPath, 'restore-state');
  return {
    directory,
    request: path.join(directory, 'request.json'),
    result: path.join(directory, 'result.json'),
    rollback: path.join(directory, 'previous.db'),
    rollbackTemp: path.join(directory, 'previous.tmp'),
    restoreTemp: path.join(directory, 'incoming.tmp'),
    db: path.join(userDataPath, 'valis.db'),
    backups: path.join(userDataPath, 'backups'),
  };
}

function atomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value), { flag: 'wx' });
    fs.renameSync(temp, filePath);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

function readJson(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const input = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(input, chunk, 0, chunk.length, null);
      if (!count) break;
      hash.update(chunk.subarray(0, count));
    }
    return hash.digest('hex');
  } finally { fs.closeSync(input); }
}

function cleanupSidecars(dbPath) {
  for (const suffix of ['-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

function recordResult(paths, status, message) {
  const result = { status, message, at: Date.now() };
  atomicJson(paths.result, result);
  return result;
}

export function readRestoreResult(userDataPath) {
  try { return readJson(restorePaths(userDataPath).result); }
  catch { return { status: 'error', message: 'Could not read restore status', at: Date.now() }; }
}

export function requestLocalRestore(userDataPath, dateKey) {
  if (!isValidDateKey(dateKey)) throw new Error('Invalid backup date');
  const paths = restorePaths(userDataPath);
  if (fs.existsSync(paths.request)) throw new Error('A restore is already pending');
  const source = path.join(paths.backups, `valis-${dateKey}.db`);
  validateDatabaseFile(source);
  const request = { version: VERSION, stage: 'requested', dateKey, hash: sha256(source), requestedAt: Date.now() };
  atomicJson(paths.request, request);
  return { success: true, dateKey };
}

function checkRequest(request) {
  if (request?.version !== VERSION || !isValidDateKey(request?.dateKey) ||
      typeof request?.hash !== 'string' || !/^[0-9a-f]{64}$/.test(request.hash) ||
      !['requested', 'rollback-ready', 'replacing', 'awaiting-confirmation'].includes(request.stage)) {
    throw new Error('Invalid restore request');
  }
}

function sourceFor(paths, request) {
  const source = path.join(paths.backups, `valis-${request.dateKey}.db`);
  validateDatabaseFile(source);
  if (sha256(source) !== request.hash) throw new Error('Backup changed after restore was requested');
  return source;
}

async function captureRollback(paths) {
  if (!fs.existsSync(paths.db)) throw new Error('Current database is missing');
  fs.rmSync(paths.rollbackTemp, { force: true });
  const current = new Database(paths.db);
  try { await current.backup(paths.rollbackTemp); }
  finally { current.close(); }
  validateDatabaseFile(paths.rollbackTemp);
  fs.renameSync(paths.rollbackTemp, paths.rollback);
}

function installSnapshot(source, paths) {
  fs.rmSync(paths.restoreTemp, { force: true });
  fs.copyFileSync(source, paths.restoreTemp);
  validateDatabaseFile(paths.restoreTemp);
  cleanupSidecars(paths.db);
  fs.renameSync(paths.restoreTemp, paths.db);
  validateDatabaseFile(paths.db);
}

function recoverPrevious(paths, message) {
  validateDatabaseFile(paths.rollback);
  installSnapshot(paths.rollback, paths);
  fs.rmSync(paths.request, { force: true });
  fs.rmSync(paths.rollback, { force: true });
  return recordResult(paths, 'recovered', message);
}

export async function applyPendingRestore(userDataPath) {
  const paths = restorePaths(userDataPath);
  if (!fs.existsSync(paths.request)) return null;
  let request;
  let rollbackCaptured = false;
  try {
    request = readJson(paths.request);
    checkRequest(request);
    if (request.stage !== 'requested') {
      return recoverPrevious(paths, 'An interrupted restore was rolled back to the previous database.');
    }
    sourceFor(paths, request);
    // A request is written before any database replacement; an old rollback here is stale.
    fs.rmSync(paths.rollback, { force: true });
    await captureRollback(paths);
    rollbackCaptured = true;
    atomicJson(paths.request, { ...request, stage: 'rollback-ready' });
    atomicJson(paths.request, { ...request, stage: 'replacing' });
    installSnapshot(sourceFor(paths, request), paths);
    atomicJson(paths.request, { ...request, stage: 'awaiting-confirmation' });
    return { status: 'awaiting-confirmation', dateKey: request.dateKey };
  } catch (error) {
    if ((rollbackCaptured || ['rollback-ready', 'replacing', 'awaiting-confirmation'].includes(request?.stage)) && fs.existsSync(paths.rollback)) {
      try { return recoverPrevious(paths, `Restore failed and the previous database was recovered: ${error.message}`); }
      catch (recoveryError) {
        throw new Error(`Restore failed and rollback could not be verified: ${recoveryError.message}`, { cause: error });
      }
    }
    if (request?.stage === 'requested' || !request) {
      // A stale rollback can predate this request; the current database has not been replaced.
      fs.rmSync(paths.rollback, { force: true });
      fs.rmSync(paths.request, { force: true });
      return recordResult(paths, 'error', `Restore was not applied: ${error.message}`);
    }
    throw error;
  } finally {
    fs.rmSync(paths.rollbackTemp, { force: true });
    fs.rmSync(paths.restoreTemp, { force: true });
  }
}

export function confirmRestoredBoot(userDataPath) {
  const paths = restorePaths(userDataPath);
  const request = readJson(paths.request);
  if (!request || request.stage !== 'awaiting-confirmation') return null;
  checkRequest(request);
  validateDatabaseFile(paths.db);
  const result = recordResult(paths, 'restored', `Database restored from ${request.dateKey}.`);
  fs.rmSync(paths.request, { force: true });
  fs.rmSync(paths.rollback, { force: true });
  return result;
}
