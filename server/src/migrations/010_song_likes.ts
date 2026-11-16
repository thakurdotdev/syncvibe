import type { MigrationStep } from './types';

/** Songs a listener liked: their Liked Songs list and the strongest sign of taste we get. */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS song_likes (
       user_id     INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       song_ref_id INTEGER NOT NULL REFERENCES songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, song_ref_id)
     )`,
    { transaction }
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_song_likes_user_created ON song_likes (user_id, created_at DESC)`,
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS song_likes', { transaction });
};
