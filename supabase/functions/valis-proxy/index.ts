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

      if (!clientId || !clientSecret || !configuredRedirectUri) {
        return new Response(JSON.stringify({ error: 'Blizzard OAuth is not configured.', code: 'BLIZZARD_BACKEND_NOT_CONFIGURED' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }
      if (!code || redirectUri !== configuredRedirectUri) {
        return new Response(JSON.stringify({ error: 'Invalid Blizzard OAuth request.', code: 'BLIZZARD_OAUTH_REQUEST_INVALID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }

      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      });
      const tokenResponse = await fetch('https://oauth.battle.net/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenBody
      });
      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ error: 'Battle.net rejected the authorization code.', code: 'BLIZZARD_TOKEN_EXCHANGE_FAILED' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData?.access_token) {
        return new Response(JSON.stringify({ error: 'Battle.net did not return an access token.', code: 'BLIZZARD_TOKEN_MISSING' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }
      const identityResponse = await fetch('https://oauth.battle.net/oauth/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      if (!identityResponse.ok) {
        return new Response(JSON.stringify({ error: 'Battle.net identity could not be read.', code: 'BLIZZARD_IDENTITY_FETCH_FAILED' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }

      const identity = await identityResponse.json();
      if (!identity?.sub) {
        return new Response(JSON.stringify({ error: 'Battle.net identity was incomplete.', code: 'BLIZZARD_IDENTITY_MISSING' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }
      return new Response(JSON.stringify({ sub: identity.sub, battletag: identity.battletag || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    return new Response(JSON.stringify({ error: "Endpoint not handled" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[Proxy] Critical Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
