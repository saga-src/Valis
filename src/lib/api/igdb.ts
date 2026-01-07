
import axios from 'axios';
import { IGDBGame } from '../../types/igdb';

// Use the proxy server URL
const PROXY_BASE = 'http://localhost:3001/api';

export async function searchGames(query: string): Promise<IGDBGame[]> {
  // Use Electron IPC if available (Migration)
  if (window.api && window.api.searchGames) {
    try {
      const results = await window.api.searchGames(query);
      // Map the simplified result back to IGDBGame structure expected by UI
      return results.map((r: any) => ({
        id: Number(r.id),
        name: r.name, // Updated from r.title
        cover: r.cover_url ? { url: r.cover_url } : undefined,
        first_release_date: r.first_release_date,
        total_rating: r.rating
      }));
    } catch (e) {
      console.error("IPC Search failed:", e);
      return [];
    }
  }

  // Fallback to direct Proxy (Dev mode / Web)
  try {
    // Escaping quotes in query to prevent Apicalypse errors
    const safeQuery = query.replace(/"/g, '\\"');
    
    // Removed time_to_beat fields for faster/lighter search
    const igdbBody = `
      search "${safeQuery}";
      fields name, summary, storyline, cover.url, 
      screenshots.url, genres.name, themes.name, 
      platforms.name, platforms.abbreviation, platforms.platform_logo.url, 
      involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
      game_engines.name, player_perspectives.name, game_modes.name,
      first_release_date, total_rating, category, game_type, parent_game.name;
      limit 20;
    `;

    const response = await axios.post(`${PROXY_BASE}/search`, igdbBody, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    return response.data;
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

export async function fetchTimeToBeat(gameId: number): Promise<{ normally?: number; completely?: number; hastily?: number } | null> {
  try {
    const igdbBody = `
      fields normally, completely, hastily;
      where game_id = ${gameId};
      limit 1;
    `;

    const response = await axios.post(`${PROXY_BASE}/ttb`, igdbBody, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    if (response.data && response.data.length > 0) {
      return {
        normally: response.data[0].normally,
        completely: response.data[0].completely,
        hastily: response.data[0].hastily
      };
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch TTB for game ${gameId}:`, error);
    return null;
  }
}

export const getCoverUrl = (url: string | undefined, size: 'big' | 'huge' = 'big') => {
  if (!url) {
    return 'https://placehold.co/400x600?text=No+Cover'; 
  }

  // 1. Strip any leading slashes or protocols to get a clean path
  const cleanPath = url.replace(/^(\/\/|http:\/\/|https:\/\/)/, '');
  
  // 2. Prepend HTTPS explicitly
  const secureUrl = `https://${cleanPath}`;

  // 3. Upgrade Resolution
  const targetSize = size === 'big' ? 't_cover_big' : 't_1080p';
  
  return secureUrl.replace('t_thumb', targetSize);
};
