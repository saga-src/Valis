
import { db, rawDb } from '../client.js';
import crypto from 'crypto';
import { fetchIGDBMetadata } from '../../lib/igdb.js';
import { getMetadataFields, getLibraryFields } from './utils.js';
import { refreshSteamAchievements } from './achievements.js';

// Helper to normalize legacy playtime to Array structure
function normalizeLegacyPlaytime(val) {
  if (typeof val === 'number') {
    return [{ source: 'Manual', platform_id: null, seconds: val }];
  }
  if (!val) return [];
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper to sum seconds from legacy structure for analytics compatibility
function sumLegacySeconds(val) {
  const arr = normalizeLegacyPlaytime(val);
  return arr.reduce((acc, curr) => acc + (curr.seconds || 0), 0);
}

export async function recalculatePlaytime(gameId) {
  const result = await db.selectFrom('sessions')
    .select(db.fn.sum('duration_seconds').as('total'))
    .where('game_id', '=', String(gameId))
    .executeTakeFirst();

  const total = result && result.total ? Number(result.total) : 0;

  await db.updateTable('library')
    .set({ playtime_seconds: total, updated_at: Date.now() })
    .where('game_id', '=', String(gameId))
    .execute();
    
  return total;
}

export async function getLibrary() {
  // FIX: Reordered to SELECT l.*, g.* to ensure g.rating (IGDB) wins over l.rating (User)
  // We explicitly alias l.rating to user_rating so we keep both.
  const rows = rawDb.prepare(`
    SELECT 
      l.*,
      g.*, 
      l.rating as user_rating,
      g.name as title,
      (SELECT GROUP_CONCAT(COALESCE(store_id, platform_id)) FROM library_platforms WHERE game_id = g.id) as platform_string,
      (SELECT SUM(acquired_price) FROM library_platforms WHERE game_id = g.id) as acquired_price,
      l.executable_path as executable
    FROM games g
    INNER JOIN library l ON g.id = l.game_id
    ORDER BY l.added_at DESC
  `).all();

  return rows.map(r => ({
    ...r,
    owned_platform_ids: JSON.stringify(r.platform_string ? r.platform_string.split(',').map(Number) : []),
    // ⚡ Return structured legacy data
    legacy_playtime_seconds: normalizeLegacyPlaytime(r.legacy_playtime_seconds)
  }));
}

export async function getAnalyticsData() {
  // FIX: Same reorder here to ensure consistency if analytics uses ratings later
  const rows = rawDb.prepare(`
    SELECT 
      l.*,
      g.*,
      l.rating as user_rating,
      g.name as title,
      (SELECT SUM(duration_seconds) FROM sessions WHERE game_id = g.id) as total_session_seconds,
      (SELECT SUM(s.duration_seconds) 
       FROM sessions s 
       WHERE s.game_id = g.id 
       AND (s.platform_id IS NULL OR s.platform_id NOT IN (99999, 100000))) as official_session_seconds,
      (SELECT platform_id FROM library_platforms WHERE game_id = g.id LIMIT 1) as primary_platform_id,
      (SELECT SUM(acquired_price) FROM library_platforms WHERE game_id = g.id) as price
    FROM games g
    INNER JOIN library l ON g.id = l.game_id
  `).all();

  // ⚡ Flatten legacy playtime to a number for analytics consumers
  return rows.map(r => ({
    ...r,
    legacy_playtime_seconds: sumLegacySeconds(r.legacy_playtime_seconds)
  }));
}

export async function getGameById(id) {
  // FIX: Reordered to SELECT l.*, g.*
  const row = rawDb.prepare(`
    SELECT 
      l.*, 
      g.*, 
      l.rating as user_rating,
      g.name as title,
      l.executable_path as executable
    FROM games g
    LEFT JOIN library l ON g.id = l.game_id
    WHERE g.id = ?
  `).get(String(id));

  if (!row) return null;

  // Fetch Linked DLCs (Children in local DB)
  const linkedDlcs = rawDb.prepare(`
    SELECT id, name, cover_url, game_type 
    FROM games 
    WHERE parent_game_id = ?
  `).all(String(id));

  // ⚡ Fetch Platform Ownership (Crucial for Prices & Dates)
  const ownershipRows = rawDb.prepare(`
    SELECT platform_id, store_id, acquired_price, acquired_at
    FROM library_platforms 
    WHERE game_id = ?
  `).all(String(id));

  const platformOwnership = ownershipRows.map(p => ({
      id: p.store_id || p.platform_id,
      acquired_price: p.acquired_price, // Explicit field
      price: p.acquired_price, // Legacy alias
      acquired_at: p.acquired_at
  }));

  return {
    ...row,
    owned_platform_ids: JSON.stringify(platformOwnership.map(p => p.id)),
    platform_ownership: platformOwnership,
    acquired_price: platformOwnership.reduce((sum, p) => sum + (p.price || 0), 0),
    dlcs: row.dlcs ? JSON.parse(row.dlcs) : [],
    linked_dlcs: linkedDlcs,
    // ⚡ Return structured legacy data
    legacy_playtime_seconds: normalizeLegacyPlaytime(row.legacy_playtime_seconds)
  };
}

export async function getGamesWithExecutables() {
  const rows = await db.selectFrom('library')
    .innerJoin('games', 'games.id', 'library.game_id')
    .select(['games.id', 'games.name as title', 'library.executable_path as executable'])
    .where('library.executable_path', 'is not', null)
    .where('library.executable_path', '!=', '')
    .execute();
  return rows;
}

export async function addGame(game) {
  const id = String(game.id || crypto.randomUUID());

  let richData = {};
  if (!game.genres && !game.involved_companies && /^\d+$/.test(id)) {
      try {
          const fetched = await fetchIGDBMetadata(id);
          if (fetched) richData = fetched;
      } catch (e) {
          console.warn('[DB] Metadata auto-fetch failed:', e.message);
      }
  }

  // ⚡ Ensure structured data is stringified before SQL insert
  const gameToSave = { ...game };
  if (Array.isArray(gameToSave.legacy_playtime_seconds)) {
      gameToSave.legacy_playtime_seconds = JSON.stringify(gameToSave.legacy_playtime_seconds);
  }

  const merged = { ...gameToSave, ...richData, id };
  const metadata = getMetadataFields(merged);
  const library = getLibraryFields(merged);
  
  // Set executable_path in library fields
  if (game.executable) {
      library.executable_path = game.executable;
  }

  await db.transaction().execute(async (trx) => {
    await trx.insertInto('games')
      .values(metadata)
      .onConflict(oc => oc.column('id').doUpdateSet(metadata))
      .execute();

    await trx.insertInto('library')
      .values(library)
      .onConflict(oc => oc.column('game_id').doUpdateSet({
          ...library,
          updated_at: Date.now()
      }))
      .execute();

    await trx.deleteFrom('library_platforms').where('game_id', '=', id).execute();

    let ownership = [];
    if (game.platform_ownership) {
        ownership = typeof game.platform_ownership === 'string' ? JSON.parse(game.platform_ownership) : game.platform_ownership;
    } else if (game.owned_platform_ids) {
        const ids = typeof game.owned_platform_ids === 'string' ? JSON.parse(game.owned_platform_ids) : game.owned_platform_ids;
        ownership = (ids || []).map(pid => ({ id: pid, price: 0 }));
    }

    for (const op of ownership) {
        const isStore = op.id >= 99000;
        await trx.insertInto('library_platforms')
          .values({
              game_id: id,
              platform_id: isStore ? 6 : op.id,
              store_id: isStore ? op.id : null,
              acquired_price: op.acquired_price !== undefined ? op.acquired_price : (op.price || 0),
              acquired_at: op.acquired_at || null 
          })
          .execute();
    }
  });

  // Only scan if the flag is NOT present (default behavior for Search/Import)
  // Manual edits from the modal will send skip_achievement_scan: true
  if (merged.steam_id && !merged.skip_achievement_scan) {
      try {
         await refreshSteamAchievements(id, merged.steam_id);
      } catch (e) {
         console.warn('Auto-scan failed:', e);
      }
  }

  return { success: true };
}

export async function updateGame(game) {
    // ⚡ Ensure stringification before passing to addGame logic or direct update
    const gameToUpdate = { ...game };
    if (Array.isArray(gameToUpdate.legacy_playtime_seconds)) {
        gameToUpdate.legacy_playtime_seconds = JSON.stringify(gameToUpdate.legacy_playtime_seconds);
    }
    
    // --- ⚡ AUTOMATIC DATE TRACKING ---
    // Fetch previous state to detect status changes
    const currentGame = await getGameById(game.id);
    
    if (currentGame && currentGame.status !== game.status) {
        // Fetch First Session (Started) and Last Session (Beaten/Dropped)
        const firstSession = rawDb.prepare('SELECT start_time FROM sessions WHERE game_id = ? ORDER BY start_time ASC LIMIT 1').get(game.id);
        const lastSession = rawDb.prepare('SELECT end_time, start_time FROM sessions WHERE game_id = ? ORDER BY start_time DESC LIMIT 1').get(game.id); // Use start_time for sorting last session just to be safe, end_time could be 0

        const now = Date.now();
        const startTimestamp = firstSession ? firstSession.start_time : now;
        // If last session exists, prefer end_time, fallback to start_time (if active/0), fallback to now
        const endTimestamp = lastSession ? (lastSession.end_time || lastSession.start_time || now) : now;

        // Start Tracking (Use First Session)
        // Only set if not already set, or if we want to ensure accuracy when moving to 'Playing'
        if (game.status === 'Playing' && !currentGame.date_started) {
            gameToUpdate.date_started = startTimestamp;
        }

        // Beat Tracking (Use Last Session)
        if (game.status === 'Beat' && !currentGame.date_beaten) {
            gameToUpdate.date_beaten = endTimestamp;
        }

        // Completion Tracking (Use Last Session)
        if (game.status === 'Completed') {
            if (!currentGame.date_completed) gameToUpdate.date_completed = endTimestamp;
            // Completion usually implies beating the game too, fill if missing
            if (!currentGame.date_beaten) gameToUpdate.date_beaten = endTimestamp;
        }

        // Drop Tracking (Use Last Session)
        if (game.status === 'Dropped' && !currentGame.date_dropped) {
            gameToUpdate.date_dropped = endTimestamp;
        }
        
        // Endless Tracking (Use Last Session/Now)
        if (game.status === 'Endless' && !currentGame.date_endless) {
             gameToUpdate.date_endless = endTimestamp;
        }
    }
    // ---------------------------------

    // Prepare explicit update object for library table to avoid overwriting unrelated metadata if not provided
    const libraryUpdate = {
        status: gameToUpdate.status,
        final_score: gameToUpdate.final_score,
        review_metadata: typeof gameToUpdate.review_metadata === 'object' ? JSON.stringify(gameToUpdate.review_metadata) : gameToUpdate.review_metadata,
        legacy_playtime_seconds: gameToUpdate.legacy_playtime_seconds || 0,
        executable_path: gameToUpdate.executable || null,
        updated_at: Date.now(),
        // Include new date fields if they were set above or passed in
        ...(gameToUpdate.date_started !== undefined && { date_started: gameToUpdate.date_started }),
        ...(gameToUpdate.date_beaten !== undefined && { date_beaten: gameToUpdate.date_beaten }),
        ...(gameToUpdate.date_completed !== undefined && { date_completed: gameToUpdate.date_completed }),
        ...(gameToUpdate.date_dropped !== undefined && { date_dropped: gameToUpdate.date_dropped }),
        ...(gameToUpdate.date_endless !== undefined && { date_endless: gameToUpdate.date_endless }),
        // Map user_rating from frontend to database column 'rating'
        ...(gameToUpdate.user_rating !== undefined && { rating: gameToUpdate.user_rating }),
        // Include review text
        ...(gameToUpdate.review_text !== undefined && { review_text: gameToUpdate.review_text }),
    };

    await db.updateTable('library')
        .set(libraryUpdate)
        .where('game_id', '=', String(game.id))
        .execute();
        
    // Handle Platform changes if they were passed
    // If platform_ownership is present, we must update the library_platforms table
    // We reuse addGame logic for this part, but we must be careful not to trigger a reset of other fields
    // Since addGame does upsert on ID, calling it is safe for metadata updates too.
    if (game.platform_ownership || game.owned_platform_ids) {
         await addGame(gameToUpdate);
    } else if (game.genres || game.summary) {
         // If metadata fields are present, update them specifically
         await updateGameMetadata(game.id, gameToUpdate);
    }

    return await getGameById(game.id);
}

export async function updateGameMetadata(id, metadata) {
  const safe = getMetadataFields({ ...metadata, id });
  delete safe.id; 

  await db.updateTable('games')
    .set(safe)
    .where('id', '=', String(id))
    .execute();
}

export async function deleteGame(id) {
  return await db.transaction().execute(async (trx) => {
    // 1. Delete Achievement Progress (Linked to Achievements)
    // We need to delete progress entries for achievements that belong to this game
    await trx.deleteFrom('achievement_progress')
      .where('achievement_id', 'in', 
        trx.selectFrom('achievements').select('id').where('game_id', '=', id)
      )
      .execute();

    // 2. Delete Achievements
    await trx.deleteFrom('achievements')
      .where('game_id', '=', id)
      .execute();

    // 3. Delete Sessions
    await trx.deleteFrom('sessions')
      .where('game_id', '=', id)
      .execute();

    // 4. Delete Tags
    await trx.deleteFrom('game_tags')
      .where('game_id', '=', id)
      .execute();

    // 5. Delete Platform Ownership info
    await trx.deleteFrom('library_platforms')
      .where('game_id', '=', id)
      .execute();

    // 6. Finally, Delete the Game
    const result = await trx.deleteFrom('games')
      .where('id', '=', id)
      .executeTakeFirst();
      
    return result.numDeletedRows > 0;
  });
}

export async function factoryReset() {
    // 1. Delete Dependencies (Children) first
    await db.deleteFrom('achievement_progress').execute(); // References achievements & sessions
    await db.deleteFrom('achievements').execute();       // References games
    await db.deleteFrom('game_tags').execute();          // References games
    await db.deleteFrom('library_platforms').execute();  // References games
    await db.deleteFrom('sessions').execute();           // References games
    await db.deleteFrom('library').execute();            // References games

    // 2. Delete Core Data (Parents)
    await db.deleteFrom('games').execute();

    // 3. Delete Configuration
    await db.deleteFrom('settings').execute();
}
