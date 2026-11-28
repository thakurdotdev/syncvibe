import type { MigrationStep } from './types';

/**
 * Muting a conversation (no notifications from it, on any of your devices) and blocking a person
 * (they can't message or call you; you can't message them until you unblock).
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    'ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT FALSE',
    { transaction }
  );
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS chat_blocks (
       blocker_id  INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       blocked_id  INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (blocker_id, blocked_id)
     )`,
    { transaction }
  );
  // "Has anyone blocked me" is asked from the other side.
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS chat_blocks_blocked ON chat_blocks (blocked_id)',
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS chat_blocks', { transaction });
  await sequelize.query('ALTER TABLE chat_members DROP COLUMN IF EXISTS muted', { transaction });
};
