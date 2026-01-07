import { IGDBGame } from '../../types/igdb';
import { PlatformOwnership } from '../../types/index';
import { generateId } from '../utils/format';
import { getCoverUrl, fetchTimeToBeat } from '../api/igdb';
import { saveGame } from '../storage';

export async function addGameToLibrary(game: IGDBGame, ownership: PlatformOwnership[] = []): Promise<void> {
  
  // Backward compatibility: Create simple ID list
  const ownedPlatformIds = ownership.map(o => o.id);
  
  // Calculate total spent for simple sorting/display
  const totalSpent = ownership.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // Fetch specialized data (fetch-on-add)
  let timeToBeatData = game.time_to_beat;
  if (!timeToBeatData) {
    const fetched = await fetchTimeToBeat(game.id);
    if (fetched) {
      timeToBeatData = fetched;
    }
  }

  const gameData = {
    id: generateId(),
    igdb_id: game.id,
    title: game.name,
    category: game.category ?? 0,
    parent_game_id: game.parent_game?.id ? String(game.parent_game.id) : null,
    status: 'Backlog',
    first_release_date: game.first_release_date ?? null,
    summary: game.summary ?? '',
    storyline: game.storyline ?? '',
    platforms: JSON.stringify(game.platforms ?? []),
    owned_platform_ids: JSON.stringify(ownedPlatformIds),
    platform_ownership: JSON.stringify(ownership),
    genres: JSON.stringify(game.genres ?? []),
    themes: JSON.stringify(game.themes ?? []),
    involved_companies: JSON.stringify(game.involved_companies ?? []),
    game_engines: JSON.stringify(game.game_engines ?? []),
    player_perspectives: JSON.stringify(game.player_perspectives ?? []), 
    game_modes: JSON.stringify(game.game_modes ?? []),
    franchises: JSON.stringify([]), 
    time_to_beat: JSON.stringify(timeToBeatData ?? {}), 
    cover_url: getCoverUrl(game.cover?.url, 'big'),
    backdrop_url: game.screenshots && game.screenshots.length > 0 
      ? getCoverUrl(game.screenshots[0].url, 'huge') 
      : '',
    screenshots: JSON.stringify(game.screenshots ?? []),
    acquired_price: totalSpent,
    final_score: null,
    review_metadata: JSON.stringify({}),
    primary_color: '#000000', 
    executable: null,
  };

  // Use the Electron IPC storage API
  await saveGame(gameData);
}