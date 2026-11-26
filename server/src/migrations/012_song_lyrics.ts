import type { MigrationStep } from './types';

/**
 * Lyrics found for a song, kept so each song is looked up once. `kind` 'none' is kept too, so a
 * song without lyrics isn't searched for on every play; it is tried again after a while.
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS song_lyrics (
       -- The song API's id (songs."songId"); the song may not be stored in songs yet.
       song_id        TEXT PRIMARY KEY,
       kind           TEXT NOT NULL CHECK (kind IN ('synced', 'plain', 'none')),
       -- [{ t: ms, text }] for synced lyrics.
       lines          JSONB,
       plain_text     TEXT,
       source         TEXT,
       -- Which entry at the source, so a "wrong lyrics" report can rule it out.
       source_ref     TEXT,
       rejected_refs  TEXT[] NOT NULL DEFAULT '{}',
       fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP TABLE IF EXISTS song_lyrics', { transaction });
};
