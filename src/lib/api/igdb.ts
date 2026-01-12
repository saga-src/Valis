import axios from 'axios';
import { IGDBGame } from '../../types/igdb';

// Use the proxy server URL
const PROXY_BASE = 'http://localhost:3001/api';

export async function searchGames(query: string): Promise<IGDBGame[]> {
  // Use Electron IPC if available (Migration)
  if (window.api && window.api.searchGames) {
    try {
      const results = await window.api.searchGames(query);
      return results.map((r: any) => ({
        id: Number(r.id),
        name: r.name, 
        cover: r.cover_url ? { url: r.cover_url } : undefined,
        first_release_date: r.first_release_date,
        total_rating: r.rating
      }));
    } catch (e: any) {
      console.error('🔥 API CRASH (IPC Search):', e);
      // Try to notify via DOM event if toast context isn't directly reachable in this utility
      window.dispatchEvent(new CustomEvent('toast-error', { detail: `IPC Search Error: ${e.message}` }));
      return [];
    }
  }

  // Fallback to direct Proxy (Dev mode / Web)
  try {
    const safeQuery = query.replace(/"/g, '\\"');
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
      headers: { 'Content-Type': 'text/plain' }
    });

    return response.data;
  } catch (error: any) {
    console.error('🔥 API CRASH (Web Proxy):', error);
    window.dispatchEvent(new CustomEvent('toast-error', { detail: `Proxy API Error: ${error.message}` }));
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
      headers: { 'Content-Type': 'text/plain' }
    });

    if (response.data && response.data.length > 0) {
      return {
        normally: response.data[0].normally,
        completely: response.data[0].completely,
        hastily: response.data[0].hastily
      };
    }
    return null;
  } catch (error: any) {
    console.warn(`Failed to fetch TTB for game ${gameId}:`, error.message);
    return null;
  }
}

export const getCoverUrl = (url: string | undefined, size: 'big' | 'huge' = 'big') => {
  if (!url) {
    return 'https://placehold.co/400x600?text=No+Cover'; 
  }
  const cleanPath = url.replace(/^(\/\/|http:\/\/|https:\/\/)/, '');
  const secureUrl = `https://${cleanPath}`;
  const targetSize = size === 'big' ? 't_cover_big' : 't_1080p';
  return secureUrl.replace('t_thumb', targetSize);
};