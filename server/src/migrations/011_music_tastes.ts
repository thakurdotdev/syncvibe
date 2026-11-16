import type { MigrationStep } from './types';

/**
 * What a listener told us they like, kept with the account so every device and the server's
 * recommendations use it. Languages used to live only on the phone.
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS music_tastes (
       user_id          INTEGER PRIMARY KEY REFERENCES users (userid) ON DELETE CASCADE,
       languages        TEXT[] NOT NULL DEFAULT '{}',
       -- [{ id, name, image }] from the song API, in the order picked.
       artists          JSONB NOT NULL DEFAULT '[]',
       -- Friends you follow back see what you're playing.
       share_listening  BOOLEAN NOT NULL DEFAULT TRUE,
       updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS music_tastes', { transaction });
};
