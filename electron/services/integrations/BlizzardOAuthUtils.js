const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function validateBlizzardRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, code: 'BLIZZARD_REDIRECT_INVALID' };
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || !url.port || url.username || url.password) {
    return { valid: false, code: 'BLIZZARD_REDIRECT_NOT_LOOPBACK' };
  }
  return { valid: true, url };
}

export function buildBlizzardAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://oauth.battle.net/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', state);
  return url.toString();
}

export function createBlizzardOAuthAttempt({ state, redirectUri, expiresAt }) {
  const expected = new URL(redirectUri);
  let consumed = false;

  return {
    consume(callbackUrl, now = Date.now()) {
      if (consumed) return { ok: false, code: 'BLIZZARD_CALLBACK_DUPLICATE' };
      if (now > expiresAt) return { ok: false, code: 'BLIZZARD_CALLBACK_EXPIRED' };

      let callback;
      try {
        callback = new URL(callbackUrl);
      } catch {
        return { ok: false, code: 'BLIZZARD_CALLBACK_INVALID' };
      }
      if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) {
        return { ok: false, code: 'BLIZZARD_CALLBACK_ORIGIN_INVALID' };
      }
      if (callback.searchParams.get('state') !== state) {
        consumed = true;
        return { ok: false, code: 'BLIZZARD_STATE_MISMATCH' };
      }

      const providerError = callback.searchParams.get('error');
      if (providerError) {
        consumed = true;
        return {
          ok: false,
          code: providerError === 'access_denied' ? 'BLIZZARD_AUTH_CANCELLED' : 'BLIZZARD_PROVIDER_ERROR'
        };
      }

      const code = callback.searchParams.get('code');
      if (!code) return { ok: false, code: 'BLIZZARD_CODE_MISSING' };
      consumed = true;
      return { ok: true, code };
    }
  };
}

export function normalizeBlizzardIdentity(value) {
  const externalId = String(value?.sub || value?.id || '').trim();
  if (!externalId) return null;
  return {
    externalId,
    username: String(value?.battletag || value?.battleTag || 'Battle.net User').trim()
  };
}
