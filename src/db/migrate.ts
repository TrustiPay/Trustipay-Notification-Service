import { db } from './sqlite';
import fs from 'fs';
import path from 'path';

export function runMigrations() {
  console.log('Running database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const getAppliedMigrations = db.prepare('SELECT version FROM schema_migrations').pluck();
  const appliedMigrations = new Set(getAppliedMigrations.all() as number[]);

  const applyMigration = db.transaction((version: number, name: string, sql: string) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(version, name, new Date().toISOString());
  });

  for (const file of files) {
    const versionMatch = file.match(/^(\d+)_/);
    if (!versionMatch) continue;
    const version = parseInt(versionMatch[1], 10);

    if (!appliedMigrations.has(version)) {
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        applyMigration(version, file, sql);
      } catch (e) {
        console.error(`Migration ${file} failed:`, e);
        throw e;
      }
    }
  }
  console.log('Migrations complete.');
}

if (require.main === module) {
  runMigrations();
}
