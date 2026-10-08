import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDatabase() {
  const dbPath = path.resolve(process.cwd(), 'activity_tracker.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  return {
    async migrate() {
      const schema = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
      db.exec(schema);
    },
    execute: async (sql, params = []) => {
      // If it's a SELECT query being called via execute, fallback to .all()
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = db.prepare(sql).all(params);
        return [rows];
      }
      const info = db.prepare(sql).run(params);
      return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
    },
    query: async (sql, params = []) => {
      const rows = db.prepare(sql).all(params);
      return [rows];
    },
    close: async () => db.close(),
  };
}
