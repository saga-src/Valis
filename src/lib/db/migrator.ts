import { Kysely } from 'kysely';
import { Database } from './schema';

export async function migrateToLatest(db: Kysely<Database>) {
  // Games Table
  await db.schema
    .createTable('games')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('igdb_id', 'integer', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('category', 'integer', (col) => col.notNull())
    .addColumn('parent_game_id', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('first_release_date', 'integer')
    .addColumn('summary', 'text')
    .addColumn('storyline', 'text')
    .addColumn('platforms', 'text') // JSON
    .addColumn('genres', 'text') // JSON
    .addColumn('themes', 'text') // JSON
    .addColumn('involved_companies', 'text') // JSON
    .addColumn('game_engines', 'text') // JSON
    .addColumn('player_perspectives', 'text') // JSON
    .addColumn('game_modes', 'text') // JSON
    .addColumn('franchises', 'text') // JSON
    .addColumn('time_to_beat', 'text') // JSON
    .addColumn('cover_url', 'text')
    .addColumn('backdrop_url', 'text')
    .addColumn('screenshots', 'text') // JSON
    .addColumn('acquired_price', 'real')
    .addColumn('final_score', 'real')
    .addColumn('review_metadata', 'text') // JSON
    .addColumn('primary_color', 'text')
    .addColumn('executable', 'text')
    .execute();

  // Add owned_platform_ids if it doesn't exist (Migration)
  try {
    await db.schema
      .alterTable('games')
      .addColumn('owned_platform_ids', 'text', (col) => col.defaultTo('[]'))
      .execute();
  } catch (e) {
    // Column likely exists
  }

  // Add platform_ownership if it doesn't exist (Migration)
  try {
    await db.schema
      .alterTable('games')
      .addColumn('platform_ownership', 'text', (col) => col.defaultTo('[]'))
      .execute();
  } catch (e) {
    // Column likely exists
  }

  // Add game_modes if it doesn't exist (Migration)
  try {
    await db.schema
      .alterTable('games')
      .addColumn('game_modes', 'text', (col) => col.defaultTo('[]'))
      .execute();
  } catch (e) {
    // Column likely exists
  }

  // Add executable if it doesn't exist (Migration)
  try {
    await db.schema
      .alterTable('games')
      .addColumn('executable', 'text')
      .execute();
  } catch (e) {
    // Column likely exists
  }

  // Sessions Table
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('start_time', 'text', (col) => col.notNull())
    .addColumn('end_time', 'text', (col) => col.notNull())
    .addColumn('duration_minutes', 'integer', (col) => col.notNull())
    .addColumn('mood', 'text', (col) => col.notNull())
    .addColumn('played_with', 'text') // JSON
    .execute();

  // Add platform_id to sessions if it doesn't exist (Migration)
  try {
    await db.schema
      .alterTable('sessions')
      .addColumn('platform_id', 'integer')
      .execute();
  } catch (e) {
    // Column likely exists
  }

  // Journal Entries Table
  await db.schema
    .createTable('journal_entries')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('entry_type', 'text', (col) => col.notNull())
    .addColumn('contains_spoilers', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}