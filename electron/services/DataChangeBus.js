import { BrowserWindow } from 'electron';

const VALID_TYPES = new Set([
  'library',
  'game',
  'session',
  'achievement',
  'gamification',
  'tag',
  'settings',
  'account',
  'restore',
  'reset'
]);

let suppressImportantDepth = 0;

function normalizePayload(payload = {}) {
  const type = VALID_TYPES.has(payload.type) ? payload.type : 'settings';
  const important = Boolean(payload.important) && suppressImportantDepth === 0;

  return {
    type,
    source: payload.source || 'unknown',
    ...(payload.gameId !== undefined && { gameId: String(payload.gameId) }),
    ...(payload.sessionId !== undefined && { sessionId: String(payload.sessionId) }),
    ...(Array.isArray(payload.ids) && { ids: payload.ids.map(String) }),
    important,
    at: payload.at || Date.now()
  };
}

export function emitDataChange(payload) {
  const event = normalizePayload(payload);

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('data:changed', event);
    }
  }

  return event;
}

export async function withDataChangeSuppressed(fn) {
  suppressImportantDepth += 1;
  try {
    return await fn();
  } finally {
    suppressImportantDepth = Math.max(0, suppressImportantDepth - 1);
  }
}
