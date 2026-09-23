import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { shell } from 'electron';
import { cloudGate } from '../CloudGate.js';
import { rawDb } from '../../db/client.js';
import { createBlizzardWowImportService } from './BlizzardWowImportService.js';
import {
  buildBlizzardAuthorizeUrl,
  createBlizzardOAuthAttempt,
  normalizeBlizzardRegion,
  normalizeBlizzardIdentity,
  validateBlizzardRedirectUri
} from './BlizzardOAuthUtils.js';

const AUTH_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:43821/oauth/blizzard/callback';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function callbackPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui;background:#09090b;color:#fafafa;padding:48px"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p>You can close this window.</p></body></html>`;
}

function resultForCode(code) {
  const messages = {
    BLIZZARD_AUTH_CANCELLED: 'Battle.net authorization was cancelled.',
    BLIZZARD_STATE_MISMATCH: 'Battle.net callback failed the security check.',
    BLIZZARD_CALLBACK_EXPIRED: 'Battle.net authorization expired.',
    BLIZZARD_CALLBACK_DUPLICATE: 'Battle.net callback was already used.'
  };
  return { success: false, status: code === 'BLIZZARD_AUTH_CANCELLED' ? 'cancelled' : 'error', code, message: messages[code] || 'Battle.net authorization failed.' };
}

export class BlizzardAuthService {
  constructor() {
    this.activeAttempt = null;
    this.pendingImport = null;
    this.importer = createBlizzardWowImportService(rawDb);
  }

  async importSnapshot({ identity, region, wow, selectedGameId = null, createNew = false }) {
    const result = await this.importer.importSnapshot({
      account: identity,
      region,
      snapshot: wow,
      selectedGameId,
      createNew
    });
    const account = { externalId: identity.externalId, username: identity.username };
    const counts = result.counts || {};
    const summary = {
      success: true,
      status: result.status === 'ambiguous' ? 'needs-selection' : result.status === 'imported' ? wow.status : result.status,
      account,
      region,
      gameId: result.game?.id,
      characters: counts.characters ?? 0,
      achievements: counts.confirmedAchievements ?? 0,
      failures: (wow.summary?.charactersFailed || 0) + (wow.summary?.charactersSkipped || 0)
    };
    if (result.status === 'ambiguous') {
      const pendingId = randomBytes(16).toString('hex');
      this.pendingImport = { pendingId, identity, region, wow, candidates: result.candidates, expiresAt: Date.now() + 10 * 60_000 };
      return { ...summary, pendingId, candidates: result.candidates.map(({ id, name }) => ({ id, name })) };
    }
    this.pendingImport = null;
    return summary;
  }

  async selectGame({ pendingId, gameId = null } = {}) {
    const pending = this.pendingImport;
    if (!pending || pending.pendingId !== pendingId || pending.expiresAt < Date.now()) {
      this.pendingImport = null;
      return { success: false, status: 'error', code: 'BLIZZARD_SELECTION_EXPIRED', message: 'The WoW import choice expired. Sync again.' };
    }
    if (gameId !== null && !pending.candidates.some((candidate) => candidate.id === gameId)) {
      return { success: false, status: 'error', code: 'BLIZZARD_GAME_INVALID', message: 'Choose a WoW entry from the list.' };
    }
    try {
      return await this.importSnapshot({
        identity: pending.identity,
        region: pending.region,
        wow: pending.wow,
        selectedGameId: gameId,
        createNew: gameId === null
      });
    } catch {
      return { success: false, status: 'error', code: 'BLIZZARD_IMPORT_FAILED', message: 'WoW Retail import failed. Sync again.' };
    }
  }

  async login(options = {}) {
    if (this.activeAttempt) return { success: false, status: 'pending', code: 'BLIZZARD_AUTH_IN_PROGRESS', message: 'Battle.net authorization is already in progress.' };

    const selectedRegion = normalizeBlizzardRegion(options?.region || 'us');
    if (!selectedRegion) return { success: false, status: 'error', code: 'BLIZZARD_REGION_INVALID', message: 'Choose a supported Battle.net region.' };
    this.pendingImport = null;

    const clientId = process.env.VITE_BLIZZARD_CLIENT_ID || '';
    const redirectUri = process.env.VITE_BLIZZARD_REDIRECT_URI || DEFAULT_REDIRECT_URI;
    if (!clientId) {
      return { success: false, status: 'configuration-required', code: 'BLIZZARD_CLIENT_ID_MISSING', message: 'Configure VITE_BLIZZARD_CLIENT_ID and the matching backend secrets before connecting Battle.net.' };
    }

    const redirect = validateBlizzardRedirectUri(redirectUri);
    if (!redirect.valid) {
      return { success: false, status: 'configuration-required', code: redirect.code, message: 'The Blizzard redirect URI must be a registered fixed loopback HTTP address.' };
    }

    const state = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + AUTH_TIMEOUT_MS;
    const attempt = createBlizzardOAuthAttempt({ state, redirectUri, expiresAt });

    return new Promise((resolve) => {
      let settled = false;
      let server;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        this.activeAttempt = null;
        if (server?.listening) server.close();
        resolve(result);
      };

      const handleRequest = async (request, response) => {
        const callbackUrl = new URL(request.url || '/', redirect.url.origin).toString();
        if (new URL(callbackUrl).pathname !== redirect.url.pathname) {
          response.writeHead(404, { 'Cache-Control': 'no-store' });
          response.end();
          return;
        }
        const consumed = attempt.consume(callbackUrl);
        if (!consumed.ok) {
          const result = resultForCode(consumed.code);
          response.writeHead(result.status === 'cancelled' ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage(result.status === 'cancelled' ? 'Authorization cancelled' : 'Authorization failed', result.message));
          finish(result);
          return;
        }

        try {
          const payload = await cloudGate.fetchBlizzardWowSnapshot({ code: consumed.code, redirectUri, region: selectedRegion });
          if (settled) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(callbackPage('Authorization ended', 'Return to Valis to try again.'));
            return;
          }
          const identity = normalizeBlizzardIdentity(payload);
          if (!identity) throw Object.assign(new Error('Battle.net did not return an account identity.'), { code: 'BLIZZARD_IDENTITY_MISSING' });

          // The sanitized snapshot is kept in the main process until the local
          // importer has associated it with a WoW game; no token enters SQLite.
          const wow = payload?.wow;
          if (!wow || wow.region !== selectedRegion || !['complete', 'partial', 'empty'].includes(wow.status)) {
            throw Object.assign(new Error('The WoW Retail profile could not be read.'), { code: 'BLIZZARD_WOW_SNAPSHOT_FAILED' });
          }
          const importResult = await this.importSnapshot({ identity, region: selectedRegion, wow });
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage('Battle.net connected', `Connected as ${identity.username}. Return to Valis to finish the import.`));
          finish(importResult);
        } catch (error) {
          response.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage('Authorization failed', 'Valis could not confirm the Battle.net identity.'));
          finish({
            success: false,
            status: 'error',
            code: /^[A-Z0-9_]+$/.test(error?.response?.data?.code || error?.code || '')
              ? (error.response?.data?.code || error.code)
              : 'BLIZZARD_EXCHANGE_FAILED',
            message: 'Battle.net authorization or WoW Retail import failed. Try again.'
          });
        }
      };

      server = http.createServer((request, response) => void handleRequest(request, response));
      const timeoutHandle = setTimeout(() => finish({ success: false, status: 'timeout', code: 'BLIZZARD_AUTH_TIMEOUT', message: 'Battle.net authorization timed out.' }), AUTH_TIMEOUT_MS);
      this.activeAttempt = {
        cancel: () => finish({ success: false, status: 'cancelled', code: 'BLIZZARD_AUTH_CANCELLED', message: 'Battle.net authorization was cancelled.' })
      };

      server.once('error', (error) => finish({ success: false, status: 'error', code: error.code || 'BLIZZARD_CALLBACK_SERVER_FAILED', message: 'The local Battle.net callback could not be started.' }));
      server.listen(Number(redirect.url.port), redirect.url.hostname, async () => {
        try {
          await shell.openExternal(buildBlizzardAuthorizeUrl({ clientId, redirectUri, state, region: selectedRegion }));
        } catch {
          finish({ success: false, status: 'error', code: 'BLIZZARD_BROWSER_OPEN_FAILED', message: 'The Battle.net authorization page could not be opened.' });
        }
      });
    });
  }

  cancel() {
    if (!this.activeAttempt) return { success: false, status: 'idle', code: 'BLIZZARD_AUTH_NOT_ACTIVE' };
    this.activeAttempt.cancel();
    return { success: true, status: 'cancelled' };
  }
}

export default new BlizzardAuthService();
