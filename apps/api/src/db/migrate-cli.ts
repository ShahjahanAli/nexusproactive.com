import { Pool } from 'pg';
import { config } from '../config';
import {
  baseline,
  makeMigrationFile,
  migrate,
  migrationStatus,
  rollback,
} from './migrator';

const pool = new Pool({ connectionString: config.databaseUrl });

async function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case 'migrate': {
        const result = await migrate(pool);
        if (result.ran.length === 0) {
          console.log('Nothing to migrate.');
        } else {
          console.log(`Migrated: ${result.ran.join(', ')}`);
        }
        break;
      }

      case 'rollback': {
        const steps = parseInt(args[0] ?? '1', 10);
        const result = await rollback(pool, steps);
        if (result.rolledBack.length === 0) {
          console.log('Nothing to rollback.');
        } else {
          console.log(`Rolled back: ${result.rolledBack.join(', ')}`);
        }
        break;
      }

      case 'status': {
        const rows = await migrationStatus(pool);
        if (rows.length === 0) {
          console.log('No migrations found.');
          break;
        }
        const nameWidth = Math.max(...rows.map((r) => r.migration.length), 10);
        console.log(`${'Migration'.padEnd(nameWidth)}  Batch  Status`);
        console.log('-'.repeat(nameWidth + 18));
        for (const row of rows) {
          const batch = row.batch !== null ? String(row.batch) : '-';
          console.log(
            `${row.migration.padEnd(nameWidth)}  ${batch.padStart(5)}  ${row.status}`,
          );
        }
        break;
      }

      case 'baseline': {
        const marked = await baseline(pool);
        if (marked.length === 0) {
          console.log('All migrations already recorded.');
        } else {
          console.log(`Baselined (marked as ran): ${marked.join(', ')}`);
        }
        break;
      }

      case 'make': {
        const name = args.join('_');
        if (!name) {
          console.error('Usage: npm run db:make:migration -- create_users_table');
          process.exit(1);
        }
        const filePath = makeMigrationFile(name);
        console.log(`Created migration: ${filePath}`);
        break;
      }

      default:
        console.log(`Nexus DB migrations (Laravel-style)

Usage:
  npm run db:migrate              Run pending migrations
  npm run db:rollback             Roll back the last batch
  npm run db:rollback -- 2        Roll back the last 2 batches
  npm run db:migrate:status       Show migration status
  npm run db:baseline             Mark all migrations as ran (existing DB from schema.sql)
  npm run db:make:migration -- name  Create a new migration file
`);
        if (command) {
          console.error(`Unknown command: ${command}`);
          process.exit(1);
        }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
