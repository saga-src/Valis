import { cloudGate } from '../services/CloudGate.js';

function getCoverUrl(url, size = 'big') {
  if (!url) return '';
  const cleanPath = url.replace(/^(\/\/|http:\/\/|https:\/\/)/, '');
  const secureUrl = `https://${cleanPath}`;
  const targetSize = size === 'big' ? 't_cover_big' : 't_1080p';
  return secureUrl.replace('t_thumb', targetSize);
}

/**
 * Fetches metadata for a single game ID.
 */
export async function fetchIGDBMetadata(gameId) {
  const results = await fetchGamesBulk([gameId]);
  return results.length > 0 ? results[0] : null;
}

/**
 * Resolves a Steam AppID to an IGDB Game ID.
 */
export async function resolveIgdbGame(steamAppId, gameName) {
  try {
    const extBody = `fields game; where external_game_source = 1 & uid = "${steamAppId}"; limit 1;`;
    const data = await cloudGate.fetchIGDB(extBody, 'external_games');

    if (data && data.length > 0) {
      return data[0].game;
    }

    if (!gameName) return null;

    const safeName = gameName.replace(/"/g, '\\"');
    const searchBody = `search "${safeName}"; fields name, websites.type, websites.url; limit 10;`;
    const searchData = await cloudGate.fetchIGDB(searchBody, 'games');
    
    const match = (searchData || []).find(g => {
        if (!g.websites) return false;
        return g.websites.some(w => 
            (w.type === 13 || w.url.includes('steampowered.com')) && 
            w.url.includes(String(steamAppId))
        );
    });

    return match ? match.id : null;
  } catch (error) {
    console.warn(`[IGDB] Resolution failed for ${gameName}:`, error.message);
    return null;
  }
}

/**
 * Resolves an Epic Games Store slug to an IGDB Game ID.
 */
export async function resolveIgdbGameByEpicSlug(slug) {
  try {
    const extBody = `fields game; where external_game_source = 26 & uid = "${slug}"; limit 1;`;
    const data = await cloudGate.fetchIGDB(extBody, 'external_games');
    return data && data.length > 0 ? data[0].game : null;
  } catch (error) {
    return null;
  }
}

/**
 * Lookup a game by its PlayStation Network ID.
 */
export async function fetchGameByPsnId(psnId) {
  if (!psnId) return null;
  try {
    const extBody = `fields game; where external_game_source = 36 & uid = "${psnId}"; limit 1;`;
    const data = await cloudGate.fetchIGDB(extBody, 'external_games');
    return data && data.length > 0 ? data[0].game : null;
  } catch (e) {
    return null;
  }
}

/**
 * Finds the IGDB Game ID using the numeric PSN Store conceptId.
 */
export async function fetchGameByPsnStoreId(conceptId) {
    if (!conceptId) return null;
    const query = `fields game; where external_game_source = 36 & uid = "${conceptId}"; limit 1;`;
    try {
        const data = await cloudGate.fetchIGDB(query, 'external_games');
        return data && data.length > 0 ? data[0].game : null;
    } catch (e) {
        return null;
    }
}

/**
 * Finds an IGDB Game ID by an external platform UID across multiple sources.
 */
export async function fetchIGDBGameByExternalUid(sourceIds, uid) {
    if (!uid) return null;
    let sourceFilter = Array.isArray(sourceIds) 
        ? `(${sourceIds.map(id => `external_game_source = ${id}`).join(' | ')})`
        : `external_game_source = ${sourceIds}`;

    const query = `fields game; where uid = "${uid}" & ${sourceFilter}; limit 1;`;
    try {
        const data = await cloudGate.fetchIGDB(query, 'external_games');
        return data && data.length > 0 ? data[0].game : null;
    } catch (e) {
        return null;
    }
}

/**
 * Searches IGDB for games matching a query.
 */
export async function searchIGDB(query) {
  try {
    const safeQuery = query.replace(/"/g, '\\"');
    const igdbBody = `search "${safeQuery}"; fields name, cover.url, first_release_date, total_rating, platforms.name, platforms.abbreviation; limit 50;`;
    const data = await cloudGate.fetchIGDB(igdbBody, 'games');

    return (data || []).map(g => ({
      id: String(g.id),
      name: g.name,
      cover_url: getCoverUrl(g.cover ? g.cover.url : null, 'big'),
      first_release_date: g.first_release_date,
      rating: g.total_rating,
      platforms: g.platforms ? g.platforms.map(p => ({ id: p.id, name: p.name, abbreviation: p.abbreviation })) : []
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetches metadata for multiple game IDs.
 */
export async function fetchGamesBulk(gameIds) {
  if (!gameIds || gameIds.length === 0) return [];
  const idsString = gameIds.join(',');

  try {
    const igdbBody = `
      fields name, cover.url, first_release_date, total_rating, rating,
      involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
      genres.name, themes.name, player_perspectives.name, game_modes.name, 
      platforms.name, screenshots.url, game_type, parent_game.id, parent_game.name,
      summary, storyline, game_engines.name, franchises.name,
      websites.type, websites.url, external_games.external_game_source, external_games.uid;
      where id = (${idsString});
      limit 500;
    `;

    const games = await cloudGate.fetchIGDB(igdbBody, 'games');
    
    let timeData = [];
    try {
        const ttbBody = `fields game_id, normally, completely, hastily; where game_id = (${idsString}); limit 500;`;
        timeData = await cloudGate.fetchIGDB(ttbBody, 'game_time_to_beats');
    } catch (e) {}

    return (games || []).map(g => {
        const ttb = timeData.find(t => t.game_id === g.id);
        
        // --- ID EXTRACTION LOGIC ---
        let steamId = null;
        let psnId = null;        // Store ID (Source 36)
        let xboxStoreId = null;  // Microsoft Store (Source 11)
        let xboxMarketId = null; // Xbox Marketplace (Source 54)
        let epicId = null;

        // 1. Check Websites (Legacy/Fallback for Steam)
        if (g.websites && Array.isArray(g.websites)) {
            const steamSite = g.websites.find(w => w.type === 13 || (w.url && w.url.includes('store.steampowered.com/app/')));
            if (steamSite && steamSite.url) {
                const match = steamSite.url.match(/\/app\/(\d+)/);
                if (match) steamId = match[1];
            }
        }

        // 2. Check External Games (Using 'external_game_source')
        if (g.external_games && Array.isArray(g.external_games)) {
            g.external_games.forEach(ext => {
                const uid = ext.uid;
                // Support both new 'external_game_source' and old 'category' just in case
                const source = ext.external_game_source || ext.category;

                switch (source) {
                    case 1:  // Steam
                        if (!steamId) steamId = uid;
                        break;
                    case 11: // Microsoft Store (Xbox)
                        xboxStoreId = uid;
                        break;
                    case 54: // Xbox Marketplace
                        xboxMarketId = uid;
                        break;
                    case 36: // PSN Store (Generic) -> Maps to psn_id (Concept ID)
                        psnId = uid;
                        break;
                    case 26: // Epic Games Store
                        epicId = uid;
                        break;
                }
            });
        }

        return {
          id: String(g.id),
          name: g.name, 
          cover_url: getCoverUrl(g.cover ? g.cover.url : null, 'big'),
          backdrop_url: g.screenshots && g.screenshots.length > 0 ? getCoverUrl(g.screenshots[0].url, 'huge') : '',
          first_release_date: g.first_release_date,
          rating: g.total_rating || g.rating,
          involved_companies: JSON.stringify(g.involved_companies || []),
          genres: JSON.stringify(g.genres || []),
          themes: JSON.stringify(g.themes || []),
          player_perspectives: JSON.stringify(g.player_perspectives || []),
          game_modes: JSON.stringify(g.game_modes || []),
          platforms: JSON.stringify(g.platforms || []),
          screenshots: JSON.stringify(g.screenshots || []),
          game_engines: JSON.stringify(g.game_engines || []),
          franchises: JSON.stringify(g.franchises || []),
          summary: g.summary,
          storyline: g.storyline,
          game_type: g.game_type, 
          parent_game_id: g.parent_game?.id ? String(g.parent_game.id) : null,
          time_to_beat: JSON.stringify(ttb ? {
            normally: ttb.normally,
            completely: ttb.completely,
            hastily: ttb.hastily
          } : {}),
          steam_id: steamId,
          psn_id: psnId,
          xbox_store_id: xboxStoreId,
          xbox_market_id: xboxMarketId,
          epic_id: epicId
        };
    });
  } catch (error) {
    return [];
  }
}