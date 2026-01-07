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

  // Fix: Access Deno which is now declared above
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
  // Expire 1 minute early to be safe
  tokenExpiry = now + (data.expires_in * 1000) - 60000;
  
  return cachedTwitchToken;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // 1. IGDB PROXY
    if (path.endsWith('/igdb') && req.method === 'POST') {
      const endpoint = req.headers.get('igdb-endpoint') || 'games';
      const query = await req.text();
      
      if (!query) {
        return new Response(JSON.stringify({ error: "Missing Apicalypse query body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const token = await getTwitchToken();
      // Fix: Access Deno which is now declared above
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

      if (!igdbResponse.ok) {
        const errText = await igdbResponse.text();
        return new Response(JSON.stringify({ error: "IGDB Upstream Error", details: errText }), {
          status: igdbResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const data = await igdbResponse.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. STEAM ACHIEVEMENTS PROXY (User Progress)
    if (path.endsWith('/steam/achievements') && req.method === 'GET') {
      const steamId = url.searchParams.get('steamId');
      const appId = url.searchParams.get('appId');
      // Fix: Access Deno which is now declared above
      const apiKey = Deno.env.get("STEAM_WEB_API_KEY");

      if (!steamId || !appId) {
        return new Response(JSON.stringify({ error: "Missing steamId or appId parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Steam API key not configured on server" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const steamUrl = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${apiKey}&steamid=${steamId}&appid=${appId}`;
      const steamResponse = await fetch(steamUrl);

      if (!steamResponse.ok) {
        return new Response(JSON.stringify({ error: "Steam Upstream Error" }), {
          status: steamResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const data = await steamResponse.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. STEAM SCHEMA PROXY (Definitions)
    if (path.endsWith('/steam/schema') && req.method === 'GET') {
      const appId = url.searchParams.get('appId');
      const apiKey = Deno.env.get("STEAM_WEB_API_KEY");

      if (!appId) {
        return new Response(JSON.stringify({ error: "Missing appId parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Steam API key not configured on server" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const steamUrl = `http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}`;
      const steamResponse = await fetch(steamUrl);

      if (!steamResponse.ok) {
        // Return 200 with empty data if game has no stats, to prevent client errors
        if (steamResponse.status === 400 || steamResponse.status === 404) {
             return new Response(JSON.stringify({ game: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: "Steam Upstream Error" }), {
          status: steamResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const data = await steamResponse.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})