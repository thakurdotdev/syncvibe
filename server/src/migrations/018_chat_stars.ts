import type { MigrationStep } from './types';

/** Messages someone starred to find again. Each person's stars are their own. */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS chat_stars (
       user_id     INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       message_id  BIGINT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, message_id)
     )`,
    { transaction }
  );
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS chat_stars_user_recent ON chat_stars (user_id, created_at DESC)',
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS chat_stars', { transaction });
};
