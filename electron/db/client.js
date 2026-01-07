import electron from 'electron';
const { app } = electron;
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import path from 'path';

// Resolve userData path robustly (works in Main Process and Forked Proxy)
let userDataPath;
try {
  userDataPath = app ? app.getPath('userData') : process.env.USER_DATA_PATH;
} catch (e) {
  userDataPath = process.env.USER_DATA_PATH;
}

if (!userDataPath) {
  console.warn('[DB] Could not determine userData path. Defaulting to current directory.');
  userDataPath = '.';
}

// Store the DB file in the user's AppData folder (safe from updates)
const dbPath = path.join(userDataPath, 'valis.db');

// Create the raw instance
const sqliteDb = new Database(dbPath);

const dialect = new SqliteDialect({
  database: sqliteDb,
});

// Create the Kysely instance
export const db = new Kysely({
  dialect,
});

export { dbPath, sqliteDb as rawDb };
