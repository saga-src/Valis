import fs from 'fs';
import path from 'path';
import util from 'util';
import { dbPath } from '../db/client.js';

const LOG_FILE_NAME = 'valis-app-sessions.log';
const SESSION_START_PREFIX = '===== VALIS APP SESSION START';
const SESSION_END_PREFIX = '===== VALIS APP SESSION END';
const CAPTURED_METHODS = ['log', 'info', 'warn', 'error', 'debug'];

function parseSessions(text) {
  if (!text || !text.trim()) return [];

  const sessions = [];
  let current = [];

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(SESSION_START_PREFIX) && current.length > 0) {
      sessions.push(current.join('\n').trimEnd());
      current = [];
    }
    current.push(line);
  }

  if (current.length > 0) {
    sessions.push(current.join('\n').trimEnd());
  }

  return sessions.filter(Boolean);
}

function formatArg(arg) {
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (typeof arg === 'string') return arg;
  return util.inspect(arg, {
    depth: 6,
    breakLength: 160,
    maxArrayLength: 100,
  });
}

class AppSessionLogService {
  constructor() {
    this.started = false;
    this.ended = false;
    this.logPath = path.join(path.dirname(dbPath), LOG_FILE_NAME);
    this.originalConsole = {};
  }

  start(metadata = {}) {
    if (this.started) return this.logPath;

    this.started = true;
    this.ended = false;

    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });

    const previous = fs.existsSync(this.logPath)
      ? parseSessions(fs.readFileSync(this.logPath, 'utf8')).slice(-2)
      : [];

    const now = new Date().toISOString();
    const header = [
      `${SESSION_START_PREFIX} ${now} =====`,
      `App version: ${metadata.version || 'unknown'}`,
      `PID: ${process.pid}`,
      `Database: ${dbPath}`,
      `Platform: ${process.platform} ${process.arch}`,
    ].join('\n');

    fs.writeFileSync(this.logPath, [...previous, header].join('\n\n') + '\n', 'utf8');
    this.patchConsole();
    this.write('info', ['App session log started.']);

    return this.logPath;
  }

  end(reason = 'app closed') {
    if (!this.started || this.ended) return;
    this.ended = true;
    const now = new Date().toISOString();
    this.writeRaw(`${SESSION_END_PREFIX} ${now} (${reason}) =====\n`);
  }

  patchConsole() {
    for (const method of CAPTURED_METHODS) {
      if (this.originalConsole[method]) continue;

      this.originalConsole[method] = console[method].bind(console);
      console[method] = (...args) => {
        this.originalConsole[method](...args);
        this.write(method, args);
      };
    }
  }

  write(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(formatArg).join(' ');
    this.writeRaw(`[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
  }

  writeRaw(line) {
    try {
      fs.appendFileSync(this.logPath, line, 'utf8');
    } catch {
      // Logging must never interfere with app shutdown or startup.
    }
  }
}

export const appSessionLog = new AppSessionLogService();
