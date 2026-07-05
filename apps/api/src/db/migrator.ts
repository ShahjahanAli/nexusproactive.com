import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import type { MigrationModule, MigrationRecord } from './migration-types';

const MIGRATIONS_TABLE = 'migrations';

export function getMigrationsDirectory(): string {
  return path.resolve(__dirname, '../../database/migrations');
}

export async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      migration VARCHAR(255) NOT NULL UNIQUE,
      batch INT NOT NULL
    )
  `);
}

async function getRanMigrations(client: PoolClient): Promise<MigrationRecord[]> {
  const result = await client.query<MigrationRecord>(
    `SELECT id, migration, batch FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`,
  );
  return result.rows;
}

async function getNextBatch(client: PoolClient): Promise<number> {
  const result = await client.query<{ max: number | null }>(
    `SELECT MAX(batch) AS max FROM ${MIGRATIONS_TABLE}`,
  );
  return (result.rows[0]?.max ?? 0) + 1;
}

function listMigrationFiles(): string[] {
  const dir = getMigrationsDirectory();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .sort();
}

async function loadMigration(fileName: string): Promise<MigrationModule> {
  const filePath = path.join(getMigrationsDirectory(), fileName);
  const mod = (await import(pathToFileURL(filePath).href)) as MigrationModule;
  if (typeof mod.up !== 'function' || typeof mod.down !== 'function') {
    throw new Error(`Migration ${fileName} must export up() and down()`);
  }
  return mod;
}

function migrationName(fileName: string): string {
  return fileName.replace(/\.ts$/, '');
}

export async function baseline(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const marked: string[] = [];

  try {
    await ensureMigrationsTable(client);
    const executed = new Set((await getRanMigrations(client)).map((r) => r.migration));
    const files = listMigrationFiles();
    const batch = await getNextBatch(client);

    for (const file of files) {
      const name = migrationName(file);
      if (executed.has(name)) continue;

      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (migration, batch) VALUES ($1, $2)`,
        [name, batch],
      );
      marked.push(name);
    }

    return marked;
  } finally {
    client.release();
  }
}

export interface MigrateResult {
  ran: string[];
  pending: string[];
}

export async function migrate(pool: Pool): Promise<MigrateResult> {
  const client = await pool.connect();
  const ran: string[] = [];

  try {
    await ensureMigrationsTable(client);
    const executed = new Set((await getRanMigrations(client)).map((r) => r.migration));
    const files = listMigrationFiles();
    const pending = files.filter((f) => !executed.has(migrationName(f)));

    if (pending.length === 0) {
      return { ran, pending: [] };
    }

    const batch = await getNextBatch(client);

    for (const file of pending) {
      const name = migrationName(file);
      const migration = await loadMigration(file);

      await client.query('BEGIN');
      try {
        console.log(`Migrating: ${name}`);
        await migration.up(client);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (migration, batch) VALUES ($1, $2)`,
          [name, batch],
        );
        await client.query('COMMIT');
        ran.push(name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return { ran, pending: pending.filter((f) => !ran.includes(migrationName(f))) };
  } finally {
    client.release();
  }
}

export interface RollbackResult {
  rolledBack: string[];
}

export async function rollback(pool: Pool, steps = 1): Promise<RollbackResult> {
  const client = await pool.connect();
  const rolledBack: string[] = [];

  try {
    await ensureMigrationsTable(client);

    for (let step = 0; step < steps; step++) {
      const batchResult = await client.query<{ batch: number }>(
        `SELECT MAX(batch) AS batch FROM ${MIGRATIONS_TABLE}`,
      );
      const batch = batchResult.rows[0]?.batch;
      if (!batch) break;

      const batchMigrations = await client.query<MigrationRecord>(
        `SELECT id, migration, batch FROM ${MIGRATIONS_TABLE}
         WHERE batch = $1 ORDER BY id DESC`,
        [batch],
      );

      if (batchMigrations.rows.length === 0) break;

      for (const record of batchMigrations.rows) {
        const file = `${record.migration}.ts`;
        const migration = await loadMigration(file);

        await client.query('BEGIN');
        try {
          console.log(`Rolling back: ${record.migration}`);
          await migration.down(client);
          await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE id = $1`, [
            record.id,
          ]);
          await client.query('COMMIT');
          rolledBack.push(record.migration);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }

    return { rolledBack };
  } finally {
    client.release();
  }
}

export interface MigrationStatusRow {
  migration: string;
  batch: number | null;
  status: 'Ran' | 'Pending';
}

export async function migrationStatus(pool: Pool): Promise<MigrationStatusRow[]> {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const executed = await getRanMigrations(client);
    const executedMap = new Map(executed.map((r) => [r.migration, r.batch]));
    const files = listMigrationFiles();

    return files.map((file) => {
      const name = migrationName(file);
      const batch = executedMap.get(name) ?? null;
      return {
        migration: name,
        batch,
        status: batch !== null ? 'Ran' : 'Pending',
      };
    });
  } finally {
    client.release();
  }
}

export function makeMigrationFile(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) {
    throw new Error('Migration name is required');
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('_');

  const fileName = `${stamp}_${slug}.ts`;
  const dir = getMigrationsDirectory();
  fs.mkdirSync(dir, { recursive: true });

  const className = slug
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const template = `import { PoolClient } from 'pg';

/** ${className} */
export async function up(client: PoolClient): Promise<void> {
  await client.query(\`
    -- TODO: add migration SQL
  \`);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(\`
    -- TODO: reverse migration SQL
  \`);
}
`;

  const filePath = path.join(dir, fileName);
  if (fs.existsSync(filePath)) {
    throw new Error(`Migration already exists: ${fileName}`);
  }

  fs.writeFileSync(filePath, template, 'utf-8');
  return filePath;
}
