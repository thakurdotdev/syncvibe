/**
 * Applies database migrations from `src/migrations/`. Shipyard runs `bun run db:migrate` before
 * each deploy starts the new version; if it fails, the old version keeps serving.
 *
 * Usage:
 *   pnpm db:migrate                  apply every pending migration
 *   pnpm db:migrate:status           list applied and pending migrations
 *   pnpm db:migrate:down             undo the last one (ask before doing this on production)
 *   pnpm db:migrate:new <name>       create the next numbered migration file
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { sequelizeOptions } from '@/utils/sequelize';
import type { MigrationStep } from '@/migrations/types';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
const MIGRATION_FILE = /^(\d{3})_[a-z0-9_]+\.ts$/;
/** Any fixed number: it only has to keep two runs, say from overlapping deploys, apart. */
const LOCK_KEY = 7_246_310;
/** A migration waiting this long for a table lock gives up rather than stall live requests. */
const LOCK_TIMEOUT = '10s';

interface MigrationModule {
  up: MigrationStep;
  down?: MigrationStep;
}

const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();

const createMigration = (rawName: string | undefined): void => {
  const name = (rawName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!name) throw new Error('Give the migration a name: pnpm db:migrate:new add_song_likes');

  const last = migrationFiles().at(-1)?.match(MIGRATION_FILE)?.[1] ?? '000';
  const file = `${String(Number(last) + 1).padStart(3, '0')}_${name}.ts`;
  const path = join(MIGRATIONS_DIR, file);
  if (existsSync(path)) throw new Error(`${file} already exists`);

  writeFileSync(
    path,
    `import type { MigrationStep } from './types';

export const up: MigrationStep = async ({ queryInterface, transaction }) => {
  // Pass { transaction } to every query. Keep it safe to run twice (IF NOT EXISTS), and keep
  // the code that is live now working: it serves requests until the new version starts.
};

export const down: MigrationStep = async ({ queryInterface, transaction }) => {};
`
  );
  console.log(`Created src/migrations/${file}`);
};

const run = async (command: string): Promise<void> => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  // One connection, so the session lock and settings below cover every migration.
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    ...sequelizeOptions,
    pool: { max: 1, min: 0, idle: 60_000, acquire: 20_000 },
  });
  const queryInterface = sequelize.getQueryInterface();

  const umzug = new Umzug({
    migrations: {
      glob: ['[0-9][0-9][0-9]_*.ts', { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, path }) => {
        const load = async (): Promise<MigrationModule> =>
          (await import(pathToFileURL(path!).href)) as MigrationModule;
        const inTransaction = (step: MigrationStep | undefined) =>
          sequelize.transaction(async (transaction) => {
            if (!step) throw new Error(`${name} has no down step`);
            await step({ queryInterface, sequelize, transaction });
          });
        return {
          // Recorded without the extension, so a later move to compiled files keeps the history.
          name: name.replace(/\.ts$/, ''),
          up: async () => inTransaction((await load()).up),
          down: async () => inTransaction((await load()).down),
        };
      },
    },
    // Same table as sequelize-cli, so either tool sees the same history.
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  });

  umzug.on('migrating', ({ name }) => console.log(`→ ${name}`));
  umzug.on('migrated', ({ name }) => console.log(`✓ ${name}`));
  umzug.on('reverting', ({ name }) => console.log(`← ${name}`));
  umzug.on('reverted', ({ name }) => console.log(`✓ reverted ${name}`));

  try {
    await sequelize.query(`SET lock_timeout = '${LOCK_TIMEOUT}'`);
    await sequelize.query('SELECT pg_advisory_lock(:key)', { replacements: { key: LOCK_KEY } });

    if (command === 'up') {
      const applied = await umzug.up();
      console.log(
        applied.length === 0 ? 'Database is up to date' : `Applied ${applied.length} migration(s)`
      );
    } else if (command === 'status') {
      const [executed, pending] = await Promise.all([umzug.executed(), umzug.pending()]);
      for (const { name } of executed) console.log(`  applied  ${name}`);
      for (const { name } of pending) console.log(`  pending  ${name}`);
      console.log(`${executed.length} applied, ${pending.length} pending`);
    } else if (command === 'down') {
      const reverted = await umzug.down();
      if (reverted.length === 0) console.log('Nothing to undo');
    } else {
      throw new Error(`Unknown command "${command}". Use up, status, down or new.`);
    }
  } finally {
    await sequelize.close();
  }
};

const [command = 'up', ...args] = process.argv.slice(2);
const main = command === 'new' ? async () => createMigration(args[0]) : () => run(command);

main().catch((error: Error) => {
  // Umzug wraps what the migration threw; the cause says what went wrong.
  let cause: unknown = error;
  while (cause instanceof Error && cause.cause instanceof Error) cause = cause.cause;
  // The runner has one connection; a query without { transaction } waits for a second one.
  if ((cause as Error).name === 'SequelizeConnectionAcquireTimeoutError') {
    console.error('Timed out waiting for a connection: pass { transaction } to every query.');
  }
  console.error(error.message);
  process.exit(1);
});
