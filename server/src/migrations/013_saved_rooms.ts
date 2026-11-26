import type { MigrationStep } from './types';

/**
 * Rooms a host keeps: name, settings, co-hosts, the people who come (with names, so inviting them
 * needs no lookups) and the last queue. Opening one starts a live room set up the same way; while
 * it's live (`live_group_id`) the copy here follows it.
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS saved_rooms (
       id             SERIAL PRIMARY KEY,
       owner_id       INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
       name           TEXT NOT NULL,
       -- controlMode, autoPlayRecommendations, fairQueue, approveSongs.
       settings       JSONB NOT NULL DEFAULT '{}',
       co_host_ids    TEXT[] NOT NULL DEFAULT '{}',
       -- [{ userId, userName, profilePic }], most recent first.
       regulars       JSONB NOT NULL DEFAULT '[]',
       -- Song objects as the song API gives them, in queue order.
       queue          JSONB NOT NULL DEFAULT '[]',
       live_group_id  TEXT,
       created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    { transaction }
  );
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS saved_rooms_owner ON saved_rooms (owner_id, updated_at DESC)',
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS saved_rooms', { transaction });
};
