import * as SQLite from 'wa-sqlite';
// @ts-ignore
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';

export async function createBackend() {
  const module = await SQLiteAsyncESMFactory();
  const sqlite3 = SQLite.Factory(module);
  // Use OPFS (Origin Private File System)
  sqlite3.vfs_register(new SQLite.OPFSAdaptiveVFS('savestate-db', module));
  return sqlite3;
}