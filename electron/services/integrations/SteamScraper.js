import electron from 'electron';
const { net } = electron;
import { getSetting } from '../../db/modules/settings.js';
import { cloudGate } from '../CloudGate.js';

/**
 * Fetches achievement definitions for a Steam Game.
 * Prefers Cloud Proxy to avoid requiring local API keys.
 * @param {string} steamId Steam AppID
 */
export async function fetchSteamAchievements(steamId) {
    if (!steamId) return [];

    try {
        console.log(`[Scraper] Fetching Schema for AppID: ${steamId} via Cloud Proxy...`);
        const schema = await cloudGate.fetchSteamSchema(steamId);
        
        if (schema && schema.length > 0) {
            console.log(`[Scraper] ✅ Schema found via Proxy: ${schema.length} definitions.`);
            return schema.map(a => ({
                id: a.name,
                name: a.displayName,
                description: a.description || '',
                icon: a.icon,
                is_hidden: a.hidden === 1
            }));
        }
    } catch (e) {
        console.warn(`[Scraper] Cloud Proxy schema fetch failed for ${steamId}, checking local key fallback...`);
    }

    // --- FALLBACK: Local API Key ---
    const apiKey = await getSetting('steam_api_key');
    if (!apiKey) {
        console.warn('[Scraper] No local API Key found. Cannot fetch Achievement Schema.');
        return [];
    }

    const apiUrl = `http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${steamId}`;

    try {
        const jsonStr = await new Promise((resolve, reject) => {
            const req = net.request(apiUrl);
            req.on('response', res => {
                if (res.statusCode !== 200) {
                    res.on('data', () => {});
                    res.on('end', () => reject(new Error(`Steam API HTTP ${res.statusCode}`)));
                    return;
                }
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => resolve(d));
            });
            req.on('error', reject);
            req.end();
        });

        const data = JSON.parse(jsonStr);
        if (data.game && data.game.availableGameStats && data.game.availableGameStats.achievements) {
            const schema = data.game.availableGameStats.achievements;
            return schema.map(a => ({
                id: a.name,
                name: a.displayName,
                description: a.description || '',
                icon: a.icon,
                is_hidden: a.hidden === 1
            }));
        }
    } catch (e) {
        console.error(`[Scraper] Local schema fetch failed for AppID ${steamId}:`, e.message);
    }
    
    return [];
}

/**
 * Fetches player achievement progress via Cloud Proxy.
 */
export async function fetchPlayerAchievements(steamId, appId, apiKey) {
  if (!steamId || !appId) return [];
  try {
    const data = await cloudGate.fetchSteamAchievements(steamId, appId);
    return data.playerstats?.achievements || [];
  } catch (e) {
    console.warn(`[Scraper] Cloud progress fetch failed for app ${appId}:`, e.message);
    return [];
  }
}

/**
 * Fetches Owned Games via Steam Web API.
 * @param {string} steamId 
 * @param {string} apiKey 
 */
export async function fetchOwnedGames(steamId, apiKey) {
  if (!steamId || !apiKey) throw new Error('Missing credentials (SteamID or API Key)');
  
  const url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
  
  try {
    const jsonStr = await new Promise((resolve, reject) => {
      const request = net.request(url);
      request.on('response', (response) => {
        if (response.statusCode !== 200) { 
          response.on('data', () => {}); // Consume
          reject(new Error(`Steam API Error: ${response.statusCode}`)); 
          return; 
        }
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.end();
    });
    
    const data = JSON.parse(jsonStr);
    return data.response?.games || [];
  } catch (e) {
    console.error('[Scraper] fetchOwnedGames failed:', e.message);
    throw e;
  }
}

/**
 * Fetches steam user profile summary via Steam Web API.
 * @param {string} steamId 
 * @param {string} apiKey 
 */
export async function fetchSteamProfile(steamId, apiKey) {
  if (!steamId || !apiKey) return null;
  const url = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
  
  try {
    const jsonStr = await new Promise((resolve, reject) => {
      const request = net.request(url);
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
            response.on('data', () => {});
            reject(new Error(`Steam API Error: ${response.statusCode}`));
            return;
        }
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.end();
    });
    
    const data = JSON.parse(jsonStr);
    const players = data.response?.players || [];
    if (players.length > 0) {
        return { 
            username: players[0].personaname, 
            avatar: players[0].avatarfull 
        };
    }
  } catch (e) {
      console.error('[Scraper] fetchSteamProfile failed:', e.message);
  }
  return null;
}