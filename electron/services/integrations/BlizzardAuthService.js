import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { shell } from 'electron';
import { cloudGate } from '../CloudGate.js';
import { saveLinkedAccount } from '../../db/modules/settings.js';
import {
  buildBlizzardAuthorizeUrl,
  createBlizzardOAuthAttempt,
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
  }

  async login() {
    if (this.activeAttempt) return { success: false, status: 'pending', code: 'BLIZZARD_AUTH_IN_PROGRESS', message: 'Battle.net authorization is already in progress.' };

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
        const consumed = attempt.consume(callbackUrl);
        if (!consumed.ok) {
          const result = resultForCode(consumed.code);
          response.writeHead(result.status === 'cancelled' ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage(result.status === 'cancelled' ? 'Authorization cancelled' : 'Authorization failed', result.message));
          finish(result);
          return;
        }

        try {
          const rawIdentity = await cloudGate.fetchBlizzardIdentity({ code: consumed.code, redirectUri });
          const identity = normalizeBlizzardIdentity(rawIdentity);
          if (!identity) throw Object.assign(new Error('Battle.net did not return an account identity.'), { code: 'BLIZZARD_IDENTITY_MISSING' });

          await saveLinkedAccount({
            platform: 'blizzard',
            external_id: identity.externalId,
            username: identity.username,
            avatar_url: '',
            auth_data: JSON.stringify({ method: 'oauth_authorization_code', scope: 'openid', linked_at: Date.now() }),
            created_at: Date.now()
          });
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage('Battle.net connected', `Connected as ${identity.username}.`));
          finish({ success: true, status: 'complete', account: { externalId: identity.externalId, username: identity.username } });
        } catch (error) {
          response.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(callbackPage('Authorization failed', 'Valis could not confirm the Battle.net identity.'));
          finish({
            success: false,
            status: 'error',
            code: error.response?.data?.code || error.code || 'BLIZZARD_EXCHANGE_FAILED',
            message: error.response?.data?.error || error.message
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
          await shell.openExternal(buildBlizzardAuthorizeUrl({ clientId, redirectUri, state }));
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
