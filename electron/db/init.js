
import { db, rawDb } from './client.js';

export { db, rawDb };

export async function initDB() {
  console.log('[DB] Initializing Normalized Schema...');

  // 1. Static Metadata Table (IGDB Source)
  await db.schema.createTable('games').ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('cover_url', 'text')
    .addColumn('backdrop_url', 'text')
    .addColumn('summary', 'text')
    .addColumn('storyline', 'text')
    .addColumn('first_release_date', 'integer')
    .addColumn('rating', 'real') 
    .addColumn('game_type', 'integer')
    .addColumn('parent_game_id', 'text')
    .addColumn('genres', 'text') 
    .addColumn('themes', 'text')
    .addColumn('involved_companies', 'text')
    .addColumn('game_engines', 'text')
    .addColumn('player_perspectives', 'text')
    .addColumn('game_modes', 'text')
    .addColumn('platforms', 'text') 
    .addColumn('franchises', 'text')
    .addColumn('time_to_beat', 'text')
    .addColumn('screenshots', 'text')
    .addColumn('primary_color', 'text')
    .addColumn('steam_id', 'text')
    .addColumn('epic_id', 'text')
    .addColumn('psn_id', 'text')
    .addColumn('psn_trophy_id', 'text')
    .addColumn('xbox_store_id', 'text')
    .addColumn('xbox_market_id', 'text')
    .addColumn('dlcs', 'text')
    .execute();

  // 2. User Library Table (Collection Details)
  await db.schema.createTable('library').ifNotExists()
    .addColumn('game_id', 'text', (col) => col.primaryKey().references('games.id').onDelete('cascade'))
    .addColumn('status', 'text', (col) => col.defaultTo('Backlog'))
    .addColumn('final_score', 'real')
    .addColumn('rating', 'integer', (col) => col.defaultTo(0)) // User Star Rating (0-5)
    .addColumn('review_text', 'text') // Simple Review Text
    .addColumn('review_metadata', 'text')
    .addColumn('playtime_seconds', 'integer', (col) => col.defaultTo(0))
    .addColumn('legacy_playtime_seconds', 'integer', (col) => col.defaultTo(0))
    .addColumn('added_at', 'integer')
    .addColumn('updated_at', 'integer')
    .addColumn('executable_path', 'text')
    .addColumn('date_started', 'integer')
    .addColumn('date_beaten', 'integer')
    .addColumn('date_completed', 'integer')
    .addColumn('date_dropped', 'integer')
    .addColumn('date_endless', 'integer')
    .execute();

  // 3. Platform Ownership Table
  await db.schema.createTable('library_platforms').ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('platform_id', 'integer') // Hardware ID (e.g. 6)
    .addColumn('store_id', 'integer')    // Store ID (e.g. 99001)
    .addColumn('acquired_price', 'real', (col) => col.defaultTo(0))
    .addColumn('acquired_at', 'integer')
    .execute();

  // 4. Game Tags Table
  await db.schema.createTable('game_tags').ifNotExists()
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('tag_name', 'text', (col) => col.notNull())
    .addColumn('usage_count', 'integer', (col) => col.defaultTo(1))
    .addUniqueConstraint('unique_game_tag', ['game_id', 'tag_name'])
    .execute();

  // 5. Sessions Table
  await db.schema.createTable('sessions').ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('start_time', 'integer', (col) => col.notNull())
    .addColumn('end_time', 'integer')
    .addColumn('duration_seconds', 'integer', (col) => col.defaultTo(0))
    .addColumn('notes', 'text')
    .addColumn('journal_text', 'text')
    .addColumn('platform_id', 'integer')
    .addColumn('mood', 'text')
    .execute();

  // 6. Settings Table
  await db.schema.createTable('settings').ifNotExists()
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'text')
    .execute();

  // 7 & 8. Achievements & Progress
  try {
    const check = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='achievements'").get();
    if (check) {
        const cols = rawDb.prepare("PRAGMA table_info(achievements)").all();
        const hasCompositeKey = cols.filter(c => c.pk > 0).length > 1;
        
        if (!hasCompositeKey) {
            console.log('[DB] Detected legacy Achievement schema. Recreating tables...');
            rawDb.exec(`
                DROP TABLE IF EXISTS achievement_progress;
                DROP TABLE IF EXISTS achievements;
            `);
        }
    }
  } catch (e) {
    console.error('[DB] Schema check failed:', e);
  }

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
        id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon_url TEXT,
        is_hidden INTEGER DEFAULT 0,
        unlocked INTEGER DEFAULT 0,
        PRIMARY KEY (id, game_id),
        FOREIGN KEY(game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS achievement_progress (
        game_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT,
        session_id TEXT,
        PRIMARY KEY(game_id, achievement_id),
        FOREIGN KEY(game_id) REFERENCES games(id),
        FOREIGN KEY(achievement_id, game_id) REFERENCES achievements(id, game_id),
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
  `);

  // 9. Watch Paths for Achievements
  await db.schema.createTable('watch_paths').ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('recursive', 'integer', (col) => col.defaultTo(1))
    .execute();

  // 10. Linked Accounts Table (Multi-Account Support)
  await db.schema.createTable('linked_accounts').ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('platform', 'text', (col) => col.notNull()) // 'steam', 'epic', etc.
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('username', 'text')
    .addColumn('avatar_url', 'text')
    .addColumn('auth_data', 'text')
    .addColumn('created_at', 'integer', (col) => col.defaultTo(Date.now()))
    .addUniqueConstraint('unique_account', ['platform', 'external_id'])
    .execute();

  // 11. Valis Protocol - Unlocked Tiers
  await db.schema.createTable('unlocked_tiers').ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey()) // constructed ID like collector_1
    .addColumn('archetype_id', 'text', (col) => col.notNull())
    .addColumn('discipline_id', 'text', (col) => col.notNull())
    .addColumn('tier_level', 'integer', (col) => col.notNull())
    .addColumn('unlocked_at', 'text', (col) => col.notNull())
    .execute();

  // 12. Valis Protocol - Complex Stats (Streak, Shared Count, etc)
  await db.schema.createTable('user_stats').ifNotExists()
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'real', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // 13. General Marks (One-off achievements/Easter eggs)
  await db.schema.createTable('unlocked_marks').ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('unlocked_at', 'text')
    .execute();

  // 14. System Metadata (Sync & Ownership)
  await db.schema.createTable('system_meta').ifNotExists()
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'text')
    .execute();

  // Seed default metadata
  const defaultMeta = [
    { key: 'owner_id', value: 'guest' },
    { key: 'last_synced_at', value: '0' }
  ];

  for (const meta of defaultMeta) {
    await db.insertInto('system_meta')
      .values(meta)
      .onConflict(oc => oc.doNothing())
      .execute();
  }

  // Seed default watch paths
  const defaultPaths = [
    { path: '%APPDATA%\\Goldberg SteamEmu Saves', type: 'goldberg', recursive: 1 },
    { path: '%APPDATA%\\GSE Saves', type: 'goldberg', recursive: 1 },
    { path: '%PUBLIC%\\Documents\\Steam\\CODEX', type: 'codex', recursive: 1 },
    { path: '%PUBLIC%\\Documents\\Steam\\RUNE', type: 'codex', recursive: 1 }
  ];

  for (const def of defaultPaths) {
      const exists = await db.selectFrom('watch_paths')
          .select('id')
          .where('path', '=', def.path)
          .executeTakeFirst();
          
      if (!exists) {
          await db.insertInto('watch_paths').values(def).execute();
      }
  }

  console.log('[DB] Migration Check...');
  try {
    const tables = await db.introspection.getTables();
    
    // Games Table Migrations
    const gameCols = tables.find(t => t.name === 'games')?.columns || [];
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'steam_id')) {
        await db.schema.alterTable('games').addColumn('steam_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'epic_id')) {
        await db.schema.alterTable('games').addColumn('epic_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'psn_id')) {
        await db.schema.alterTable('games').addColumn('psn_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'psn_trophy_id')) {
        await db.schema.alterTable('games').addColumn('psn_trophy_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'xbox_store_id')) {
        await db.schema.alterTable('games').addColumn('xbox_store_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'xbox_market_id')) {
        await db.schema.alterTable('games').addColumn('xbox_market_id', 'text').execute();
    }
    if (gameCols.length > 0 && !gameCols.some(c => c.name === 'dlcs')) {
        await db.schema.alterTable('games').addColumn('dlcs', 'text').execute();
    }

    // Library Table Migrations
    const libCols = tables.find(t => t.name === 'library')?.columns || [];
    
    if (libCols.length > 0) {
        if (!libCols.some(c => c.name === 'legacy_playtime_seconds')) {
            await db.schema.alterTable('library').addColumn('legacy_playtime_seconds', 'integer', (col) => col.defaultTo(0)).execute();
        }
        if (!libCols.some(c => c.name === 'executable_path')) {
            await db.schema.alterTable('library').addColumn('executable_path', 'text').execute();
            // Migrate old data from library_platforms if exists (legacy check)
            try {
                rawDb.exec(`
                    UPDATE library 
                    SET executable_path = (
                        SELECT executable_path 
                        FROM library_platforms 
                        WHERE library_platforms.game_id = library.game_id 
                        AND executable_path IS NOT NULL 
                        LIMIT 1
                    )
                    WHERE EXISTS (
                        SELECT 1 
                        FROM library_platforms 
                        WHERE library_platforms.game_id = library.game_id 
                        AND executable_path IS NOT NULL
                    )
                `);
            } catch (e) {}
        }
        
        // Review Columns
        if (!libCols.some(c => c.name === 'rating')) {
            await db.schema.alterTable('library').addColumn('rating', 'integer', (col) => col.defaultTo(0)).execute();
        }
        if (!libCols.some(c => c.name === 'review_text')) {
            await db.schema.alterTable('library').addColumn('review_text', 'text').execute();
        }

        // New Date Tracking Columns
        if (!libCols.some(c => c.name === 'date_started')) await db.schema.alterTable('library').addColumn('date_started', 'integer').execute();
        if (!libCols.some(c => c.name === 'date_beaten')) await db.schema.alterTable('library').addColumn('date_beaten', 'integer').execute();
        if (!libCols.some(c => c.name === 'date_completed')) await db.schema.alterTable('library').addColumn('date_completed', 'integer').execute();
        if (!libCols.some(c => c.name === 'date_dropped')) await db.schema.alterTable('library').addColumn('date_dropped', 'integer').execute();
        if (!libCols.some(c => c.name === 'date_endless')) await db.schema.alterTable('library').addColumn('date_endless', 'integer').execute();
    }

    // Library Platforms Migration
    const lpCols = tables.find(t => t.name === 'library_platforms')?.columns || [];
    if (lpCols.length > 0 && !lpCols.some(c => c.name === 'acquired_at')) {
        await db.schema.alterTable('library_platforms').addColumn('acquired_at', 'integer').execute();
    }

    // Achievement Progress Migration
    const progressCols = tables.find(t => t.name === 'achievement_progress')?.columns || [];
    if (progressCols.length > 0 && !progressCols.some(c => c.name === 'session_id')) {
        await db.schema.alterTable('achievement_progress')
          .addColumn('session_id', 'text', (col) => col.references('sessions.id').onDelete('set null'))
          .execute();
    }

    // Achievements Migration
    const achCols = tables.find(t => t.name === 'achievements')?.columns || [];
    if (achCols.length > 0 && !achCols.some(c => c.name === 'unlocked')) {
        await db.schema.alterTable('achievements').addColumn('unlocked', 'integer', (col) => col.defaultTo(0)).execute();
    }
  } catch (e) {
    console.warn('[DB] Migration failed:', e.message);
  }

  await db.schema.createIndex('idx_sessions_game_time')
    .on('sessions')
    .columns(['game_id', 'start_time']) 
    .ifNotExists()
    .execute();

  await db.schema.createIndex('idx_achievements_game')
    .on('achievements')
    .column('game_id')
    .ifNotExists()
    .execute();
    
  await db.schema.createIndex('idx_library_status')
    .on('library') 
    .column('status')
    .ifNotExists()
    .execute();

  console.log('[DB] Initialization complete.');
}
