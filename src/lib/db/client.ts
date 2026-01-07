import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, Dialect, Driver, DatabaseConnection, QueryResult, CompiledQuery } from 'kysely';
import { createBackend } from './idb-backend';
import { Database } from './schema';

// --- Custom Driver for wa-sqlite ---
class WaSqliteDriver implements Driver {
  private db: any; // The raw sqlite3 instance
  private dbPtr: any; // Pointer to the open DB

  async init(): Promise<void> {
    const sqlite3 = await createBackend();
    this.db = sqlite3;
    // Open DB with READWRITE | CREATE flags
    this.dbPtr = await sqlite3.open_v2('savestate-db', 0x00000002 | 0x00000004); 
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return new WaSqliteConnection(this.db, this.dbPtr);
  }

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw('BEGIN'));
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }

  async releaseConnection(): Promise<void> {
    // No-op for single connection
  }

  async destroy(): Promise<void> {
    if (this.db && this.dbPtr) {
      await this.db.close(this.dbPtr);
    }
  }
}

class WaSqliteConnection implements DatabaseConnection {
  constructor(private sqlite3: any, private dbPtr: any) {}

  async executeQuery<R>(compiledQuery: CompiledQuery<unknown>): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const rows: any[] = [];
    
    // Generator-based iteration for wa-sqlite
    for await (const stmt of this.sqlite3.statements(this.dbPtr, sql)) {
      if (parameters) {
        this.sqlite3.bind_collection(stmt, parameters);
      }
      
      // Get column names for object mapping
      const cols = this.sqlite3.column_names(stmt);
      
      while ((await this.sqlite3.step(stmt)) === 360) { // SQLITE_ROW
        const row = this.sqlite3.row(stmt);
        const rowObj: any = {};
        // Map columns to values to return proper objects
        cols.forEach((col: string, i: number) => {
          rowObj[col] = row[i];
        });
        rows.push(rowObj);
      }
    }

    // Get affected rows and last insert ID
    const numAffectedRows = BigInt(this.sqlite3.changes(this.dbPtr));
    const insertId = BigInt(this.sqlite3.last_insert_rowid(this.dbPtr));

    return {
      rows: rows as R[], 
      numAffectedRows, 
      insertId
    };
  }
  
  async *streamQuery<R>(compiledQuery: CompiledQuery<unknown>, chunkSize?: number): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming not supported yet");
  }
}

// --- The Dialect ---
class WaSqliteDialect implements Dialect {
  createDriver() { return new WaSqliteDriver(); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createAdapter() { return new SqliteAdapter(); }
  createIntrospector(db: Kysely<any>) { return new SqliteIntrospector(db); }
}

// --- The Instance ---
export const db = new Kysely<Database>({
  dialect: new WaSqliteDialect(),
});