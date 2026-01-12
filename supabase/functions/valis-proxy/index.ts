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