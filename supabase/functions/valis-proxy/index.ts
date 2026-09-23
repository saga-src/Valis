import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * Fix: Declare Deno for environments where types are not loaded in the editor
 */
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, igdb-endpoint',
}

let cachedTwitchToken: string | null = null;
let tokenExpiry = 0;

const blizzardRegions = new Set(['us', 'eu', 'kr', 'tw']);
const blizzardLocales: Record<string, string> = {
  us: 'en_US',
  eu: 'en_GB',
  kr: 'ko_KR',
  tw: 'zh_TW'
};
const BLIZZARD_TOTAL_TIMEOUT_MS = 105_000;
const BLIZZARD_REQUEST_TIMEOUT_MS = 8_000;
const BLIZZARD_RETRIES = 2;
const BLIZZARD_CHARACTER_CONCURRENCY = 3;

function jsonResponse(payload: Record<string, unknown>, status = 200, noStore = false) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(noStore ? { 'Cache-Control': 'no-store' } : {})
    }
  });
}

function normalizeRegion(value: unknown) {
  const region = typeof value === 'string' ? value.trim().toLowerCase() : 'us';
  return blizzardRegions.has(region) ? region : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 2_000);
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.min(Math.max(dateMs - Date.now(), 0), 2_000);
  }
  return Math.min(300 * (attempt + 1), 1_500);
}

function sanitizedFetchError(code: string, message: string, status?: number) {
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.code = code;
  if (status) error.status = status;
  return error;
}

async function fetchJsonWithRetry(
  url: string,
  options: RequestInit,
  config: { label: string; deadline: number; retries?: number; timeoutMs?: number }
) {
  const retries = config.retries ?? BLIZZARD_RETRIES;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = config.deadline - Date.now();
    if (remaining <= 0) {
      throw sanitizedFetchError('BLIZZARD_REQUEST_TIMEOUT', `${config.label} timed out.`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs ?? BLIZZARD_REQUEST_TIMEOUT_MS, remaining));
    let response: Response | null = null;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      if (response.ok) return data;

      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < retries) {
        const waitMs = Math.min(retryDelay(response, attempt), Math.max(config.deadline - Date.now(), 0));
        if (waitMs > 0) await sleep(waitMs);
        continue;
      }
      throw sanitizedFetchError('BLIZZARD_UPSTREAM_FAILED', `${config.label} failed.`, response.status);
    } catch (error) {
      const failure = error as any;
      const isAbort = failure?.name === 'AbortError';
      if ((isAbort || !response) && attempt < retries) {
        const waitMs = Math.min(retryDelay(response, attempt), Math.max(config.deadline - Date.now(), 0));
        if (waitMs > 0) await sleep(waitMs);
        continue;
      }
      if (failure?.code) throw failure;
      throw sanitizedFetchError(isAbort ? 'BLIZZARD_REQUEST_TIMEOUT' : 'BLIZZARD_UPSTREAM_FAILED', `${config.label} failed.`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw sanitizedFetchError('BLIZZARD_UPSTREAM_FAILED', `${config.label} failed.`);
}

function blizzardApiUrl(region: string, pathname: string) {
  const url = new URL(`https://${region}.api.blizzard.com${pathname}`);
  url.searchParams.set('namespace', `profile-${region}`);
  url.searchParams.set('locale', blizzardLocales[region] || blizzardLocales.us);
  return url.toString();
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugFromHref(value: unknown) {
  const href = cleanString(value);
  if (!href) return '';
  const match = href.match(/\/realm\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function normalizeWowCharacters(profile: any, region: string) {
  const accounts = Array.isArray(profile?.wow_accounts) ? profile.wow_accounts : [];
  const seen = new Set<string>();
  const characters: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (const account of accounts) {
    const accountId = account?.id ?? null;
    const accountCharacters = Array.isArray(account?.characters) ? account.characters : [];
    for (const entry of accountCharacters) {
      const source = entry?.character || entry?.protected_character || entry;
      const realm = source?.realm || entry?.realm || {};
      const name = cleanString(source?.name || entry?.name);
      const realmSlug = cleanString(realm?.slug) || slugFromHref(realm?.key?.href);
      if (!name || !realmSlug) {
        skipped++;
        continue;
      }
      const key = `${region}:${realmSlug.toLowerCase()}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      characters.push({
        id: source?.id ?? null,
        accountId,
        name,
        realm: {
          id: realm?.id ?? null,
          name: cleanString(realm?.name) || realmSlug,
          slug: realmSlug
        },
        level: Number.isFinite(Number(source?.level)) ? Number(source.level) : null,
        playableClass: source?.playable_class ? {
          id: source.playable_class.id ?? null,
          name: cleanString(source.playable_class.name)
        } : null,
        playableRace: source?.playable_race ? {
          id: source.playable_race.id ?? null,
          name: cleanString(source.playable_race.name)
        } : null,
        faction: source?.faction ? {
          type: cleanString(source.faction.type),
          name: cleanString(source.faction.name)
        } : null
      });
    }
  }

  return { characters, skipped };
}

function validCompletedTimestamp(value: unknown) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return Math.trunc(timestamp);
}

function normalizeAchievementEntry(entry: any) {
  const achievement = entry?.achievement || {};
  const id = Number(achievement?.id ?? entry?.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const completedTimestamp = validCompletedTimestamp(entry?.completed_timestamp);
  if (!completedTimestamp) return { id: Math.trunc(id), completed: false };
  return {
    id: Math.trunc(id),
    localId: `blizzard:wow:${Math.trunc(id)}`,
    name: cleanString(achievement?.name),
    completedTimestamp
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildBlizzardWowSnapshot({ accessToken, identity, region, deadline }: {
  accessToken: string;
  identity: any;
  region: string;
  deadline: number;
}) {
  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  };
  const profile = await fetchJsonWithRetry(
    blizzardApiUrl(region, '/profile/user/wow'),
    { headers: authHeaders },
    { label: 'Battle.net WoW profile', deadline }
  );
  const { characters, skipped } = normalizeWowCharacters(profile, region);
  const characterResults = await mapWithConcurrency(characters as Array<any>, BLIZZARD_CHARACTER_CONCURRENCY, async (character) => {
    const realm = character.realm?.slug;
    const name = character.name;
    try {
      const data = await fetchJsonWithRetry(
        blizzardApiUrl(region, `/profile/wow/character/${encodeURIComponent(String(realm).toLowerCase())}/${encodeURIComponent(String(name).toLowerCase())}/achievements`),
        { headers: authHeaders },
        { label: 'Battle.net WoW character achievements', deadline }
      );
      const achievements = Array.isArray(data?.achievements) ? data.achievements : [];
      let indeterminate = 0;
      const completed = [];
      for (const entry of achievements) {
        const normalized = normalizeAchievementEntry(entry);
        if (!normalized) {
          indeterminate++;
        } else if (!normalized.completedTimestamp) {
          indeterminate++;
        } else {
          completed.push(normalized);
        }
      }
      return { character, status: 'complete', completed, indeterminate };
    } catch (error) {
      const failure = error as any;
      return {
        character,
        status: 'error',
        completed: [],
        indeterminate: 0,
        error: {
          code: failure?.code || 'BLIZZARD_CHARACTER_ACHIEVEMENTS_FAILED',
          status: failure?.status || null,
          message: 'Character achievements could not be read.'
        }
      };
    }
  });

  const achievementsById = new Map<number, any>();
  let indeterminateAchievements = 0;
  const errors = [];
  for (const result of characterResults) {
    indeterminateAchievements += result.indeterminate || 0;
    if (result.status !== 'complete') errors.push(result.error);
    for (const achievement of result.completed || []) {
      const existing = achievementsById.get(achievement.id);
      if (!existing || achievement.completedTimestamp < existing.completedTimestamp) {
        achievementsById.set(achievement.id, {
          id: achievement.id,
          localId: achievement.localId,
          name: achievement.name,
          completedTimestamp: achievement.completedTimestamp
        });
      }
    }
  }

  const failedCharacters = characterResults.filter((result) => result.status !== 'complete').length;
  const status = characters.length === 0
    ? (skipped > 0 ? 'partial' : 'empty')
    : (failedCharacters > 0 || skipped > 0 ? 'partial' : 'complete');
  const achievements = Array.from(achievementsById.values()).sort((a, b) => a.id - b.id);

  return {
    provider: 'blizzard',
    game: 'wow-retail',
    region,
    status,
    account: {
      sub: identity.sub,
      battletag: identity.battletag || null
    },
    characters,
    achievements,
    summary: {
      characters: characters.length,
      charactersSkipped: skipped,
      charactersFailed: failedCharacters,
      achievements: achievements.length,
      indeterminateAchievements
    },
    errors
  };
}

async function getTwitchToken() {
  const now = Date.now();
  if (cachedTwitchToken && now < tokenExpiry) {
    return cachedTwitchToken;
  }

  const clientId = Deno.env.get("IGDB_CLIENT_ID");
  const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Missing IGDB credentials in environment variables");
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Twitch Auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  cachedTwitchToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000) - 60000;
  
  return cachedTwitchToken;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const path = url.pathname;
  
  console.log(`[Proxy] Request: ${req.method} ${path}`);

  try {
    // 1. IGDB PROXY
    if (path.endsWith('/igdb') && req.method === 'POST') {
      const endpoint = req.headers.get('igdb-endpoint') || 'games';
      const query = await req.text();
      console.log(`[Proxy] IGDB Endpoint: ${endpoint}, Query: ${query.substring(0, 100)}...`);
      
      const token = await getTwitchToken();
      const clientId = Deno.env.get("IGDB_CLIENT_ID");

      const igdbResponse = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": clientId!,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "text/plain"
        },
        body: query
      });

      const data = await igdbResponse.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. STEAM ACHIEVEMENTS PROXY (Player Unlock Status)
    // This calls GetPlayerAchievements which includes "achieved" and "unlocktime"
    if (path.endsWith('/steam/achievements') && req.method === 'GET') {
      const steamId = url.searchParams.get('steamId');
      const appId = url.searchParams.get('appId');
      const apiKey = Deno.env.get("STEAM_WEB_API_KEY");

      console.log(`[Proxy] Steam Progress Fetch: User ${steamId}, App ${appId}`);

      if (!steamId || !appId || !apiKey) {
        return new Response(JSON.stringify({ error: "Missing required parameters or server key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const steamUrl = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${apiKey}&steamid=${steamId}&appid=${appId}`;
      const response = await fetch(steamUrl);
      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. STEAM SCHEMA PROXY (Global Definitions)
    // This calls GetSchemaForGame which returns names, descriptions, and icons
    if (path.endsWith('/steam/schema') && req.method === 'GET') {
      const appId = url.searchParams.get('appId');
      const apiKey = Deno.env.get("STEAM_WEB_API_KEY");

      console.log(`[Proxy] Steam Schema Fetch: App ${appId}`);

      if (!appId || !apiKey) {
        return new Response(JSON.stringify({ error: "Missing appId or server key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const steamUrl = `http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}`;
      const response = await fetch(steamUrl);
      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. BLIZZARD ACCOUNT IDENTITY
    // The client secret and access token stay inside this Edge Function.
    if (path.endsWith('/blizzard/identity') && req.method === 'POST') {
      const clientId = Deno.env.get('BLIZZARD_CLIENT_ID');
      const clientSecret = Deno.env.get('BLIZZARD_CLIENT_SECRET');
      const configuredRedirectUri = Deno.env.get('BLIZZARD_REDIRECT_URI');
      const body = await req.json().catch(() => null);
      const code = typeof body?.code === 'string' ? body.code : '';
      const redirectUri = typeof body?.redirectUri === 'string' ? body.redirectUri : '';
      const region = normalizeRegion(body?.region);
      const deadline = Date.now() + BLIZZARD_TOTAL_TIMEOUT_MS;

      if (!clientId || !clientSecret || !configuredRedirectUri) {
        return jsonResponse({ error: 'Blizzard OAuth is not configured.', code: 'BLIZZARD_BACKEND_NOT_CONFIGURED' }, 503, true);
      }
      if (!code || redirectUri !== configuredRedirectUri) {
        return jsonResponse({ error: 'Invalid Blizzard OAuth request.', code: 'BLIZZARD_OAUTH_REQUEST_INVALID' }, 400, true);
      }
      if (!region) {
        return jsonResponse({ error: 'Unsupported Blizzard region.', code: 'BLIZZARD_REGION_INVALID', allowedRegions: Array.from(blizzardRegions) }, 400, true);
      }

      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      });
      let tokenData;
      try {
        tokenData = await fetchJsonWithRetry(`https://${region}.battle.net/oauth/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: tokenBody
        }, { label: 'Battle.net token exchange', deadline });
      } catch {
        return jsonResponse({ error: 'Battle.net rejected the authorization code.', code: 'BLIZZARD_TOKEN_EXCHANGE_FAILED' }, 502, true);
      }
      if (!tokenData?.access_token) {
        return jsonResponse({ error: 'Battle.net did not return an access token.', code: 'BLIZZARD_TOKEN_MISSING' }, 502, true);
      }
      let identity;
      try {
        identity = await fetchJsonWithRetry(`https://${region}.battle.net/oauth/userinfo`, {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        }, { label: 'Battle.net identity', deadline });
      } catch {
        return jsonResponse({ error: 'Battle.net identity could not be read.', code: 'BLIZZARD_IDENTITY_FETCH_FAILED' }, 502, true);
      }
      if (!identity?.sub) {
        return jsonResponse({ error: 'Battle.net identity was incomplete.', code: 'BLIZZARD_IDENTITY_MISSING' }, 502, true);
      }

      let wowSnapshot;
      try {
        wowSnapshot = await buildBlizzardWowSnapshot({
          accessToken: tokenData.access_token,
          identity,
          region,
          deadline
        });
      } catch (error) {
        const failure = error as any;
        wowSnapshot = {
          provider: 'blizzard',
          game: 'wow-retail',
          region,
          status: 'error',
          account: {
            sub: identity.sub,
            battletag: identity.battletag || null
          },
          characters: [],
          achievements: [],
          summary: {
            characters: 0,
            charactersSkipped: 0,
            charactersFailed: 0,
            achievements: 0,
            indeterminateAchievements: 0
          },
          errors: [{
            code: failure?.code || 'BLIZZARD_WOW_SNAPSHOT_FAILED',
            status: failure?.status || null,
            message: 'World of Warcraft profile snapshot could not be read.'
          }]
        };
      }

      return jsonResponse({
        sub: identity.sub,
        battletag: identity.battletag || null,
        region,
        requiredScope: 'openid wow.profile',
        wow: wowSnapshot
      }, 200, true);
    }

    return new Response(JSON.stringify({ error: "Endpoint not handled" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const failure = error as any;
    if (path.endsWith('/blizzard/identity')) {
      console.error('[Proxy] Blizzard request failed:', failure?.code || 'BLIZZARD_INTERNAL_ERROR');
      return jsonResponse({ error: 'Battle.net request failed.', code: 'BLIZZARD_INTERNAL_ERROR' }, 500, true);
    }
    console.error(`[Proxy] Critical Error:`, failure);
    return new Response(JSON.stringify({ error: failure.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
