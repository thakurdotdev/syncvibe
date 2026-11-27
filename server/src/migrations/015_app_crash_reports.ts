import type { MigrationStep } from './types';

/**
 * How the app last closed when it wasn't asked to, as each phone reports it on its next launch:
 * Android's exit record (crash, native crash, ANR, low-memory kill) or a fatal JS error.
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS app_crash_reports (
       id           SERIAL PRIMARY KEY,
       user_id      INTEGER REFERENCES users (userid) ON DELETE SET NULL,
       app_version  TEXT,
       -- 'exit' (Android's record) or 'js' (a fatal JS error).
       kind         TEXT NOT NULL,
       reason       TEXT,
       description  TEXT,
       message      TEXT,
       -- An ANR's thread dump or a JS stack.
       trace        TEXT,
       happened_at  TIMESTAMPTZ,
       created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    { transaction }
  );
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS app_crash_reports_created_at ON app_crash_reports (created_at DESC)',
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS app_crash_reports', { transaction });
};
