import Database from 'better-sqlite3';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(env.DATABASE_URL.replace('file:', ''));
if (dataDir && dataDir !== '.' && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(env.DATABASE_URL.replace('file:', ''), {
  verbose: env.LOG_LEVEL === 'trace' ? console.log : undefined,
});

if (env.SQLITE_WAL_ENABLED) {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');
db.pragma(`busy_timeout = ${env.SQLITE_BUSY_TIMEOUT_MS}`);
