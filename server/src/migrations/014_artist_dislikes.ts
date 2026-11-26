import type { MigrationStep } from './types';

/** Artists a listener asked not to be recommended: their songs leave every suggestion. */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS artist_dislikes (
       user_id      INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       -- The song API's artist id.
       artist_id    TEXT NOT NULL,
       artist_name  TEXT NOT NULL,
       created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, artist_id)
     )`,
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS artist_dislikes', { transaction });
};
