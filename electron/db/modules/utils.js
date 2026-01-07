
export function getMetadataFields(game) {
  return {
    id: String(game.id),
    name: game.name || game.title || 'Unknown Game',
    cover_url: game.cover_url || (game.cover ? game.cover.url : null),
    backdrop_url: game.backdrop_url,
    summary: game.summary,
    storyline: game.storyline,
    first_release_date: game.first_release_date,
    rating: game.rating || game.total_rating || null,
    game_type: game.game_type ?? game.category,
    parent_game_id: game.parent_game_id ? String(game.parent_game_id) : null,
    genres: typeof game.genres === 'object' ? JSON.stringify(game.genres) : game.genres,
    themes: typeof game.themes === 'object' ? JSON.stringify(game.themes) : game.themes,
    involved_companies: typeof game.involved_companies === 'object' ? JSON.stringify(game.involved_companies) : game.involved_companies,
    game_engines: typeof game.game_engines === 'object' ? JSON.stringify(game.game_engines) : game.game_engines,
    player_perspectives: typeof game.player_perspectives === 'object' ? JSON.stringify(game.player_perspectives) : game.player_perspectives,
    game_modes: typeof game.game_modes === 'object' ? JSON.stringify(game.game_modes) : game.game_modes,
    platforms: typeof game.platforms === 'object' ? JSON.stringify(game.platforms) : game.platforms,
    franchises: typeof game.franchises === 'object' ? JSON.stringify(game.franchises) : game.franchises,
    time_to_beat: typeof game.time_to_beat === 'object' ? JSON.stringify(game.time_to_beat) : game.time_to_beat,
    screenshots: typeof game.screenshots === 'object' ? JSON.stringify(game.screenshots) : game.screenshots,
    primary_color: game.primary_color,
    steam_id: game.steam_id,
    epic_id: game.epic_id,
    psn_id: game.psn_id,
    psn_trophy_id: game.psn_trophy_id,
    xbox_store_id: game.xbox_store_id,
    xbox_market_id: game.xbox_market_id,
    dlcs: typeof game.dlcs === 'object' ? JSON.stringify(game.dlcs) : game.dlcs
  };
}

export function getLibraryFields(game) {
  return {
    game_id: String(game.id),
    status: game.status || 'Backlog',
    final_score: game.final_score,
    // FIX: Explicitly set to null if undefined to override DB default '0'
    rating: game.user_rating !== undefined ? game.user_rating : null,
    review_text: game.review_text || null,
    review_metadata: typeof game.review_metadata === 'object' ? JSON.stringify(game.review_metadata) : game.review_metadata,
    playtime_seconds: game.playtime_seconds || 0,
    legacy_playtime_seconds: game.legacy_playtime_seconds || 0,
    added_at: game.added_at || Date.now(),
    updated_at: Date.now(),
    // Track dates if provided in the object, otherwise undefined (will skip update if not present)
    date_started: game.date_started,
    date_beaten: game.date_beaten,
    date_completed: game.date_completed,
    date_dropped: game.date_dropped,
    date_endless: game.date_endless,
    executable_path: game.executable_path || game.executable || null
  };
}
