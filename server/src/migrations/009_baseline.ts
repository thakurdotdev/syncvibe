import { QueryTypes } from 'sequelize';
import type { MigrationStep } from './types';

/**
 * Schema changes before automatic migrations were plain SQL files in `server/sql/`, run by hand.
 * They aren't run again here: 003 and 006 copy existing data. This only checks that each one
 * was applied, so later migrations can rely on them.
 */
const APPLIED_BY_HAND: Array<{ file: string; table: string; column?: string }> = [
  { file: '001_play_events.sql', table: 'play_events' },
  { file: '002_editorial_playlists.sql', table: 'editorial_playlist_songs' },
  { file: '003_better_auth.sql', table: 'two_factors' },
  { file: '004_session_location.sql', table: 'sessions', column: 'location' },
  { file: '005_session_login_method.sql', table: 'sessions', column: 'loginMethod' },
  { file: '006_chat.sql', table: 'chat_reactions' },
  { file: '007_player_sessions.sql', table: 'player_sessions' },
  { file: '008_song_dislikes.sql', table: 'song_dislikes' },
  { file: '009_chat_attachments.sql', table: 'chat_attachments' },
];

export const up: MigrationStep = async ({ sequelize, transaction }) => {
  const missing: string[] = [];
  for (const { file, table, column } of APPLIED_BY_HAND) {
    const [found] = await sequelize.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = :table
           AND (CAST(:column AS text) IS NULL OR column_name = :column)
       ) AS present`,
      { replacements: { table, column: column ?? null }, type: QueryTypes.SELECT, transaction }
    );
    if (!found?.present) missing.push(file);
  }
  if (missing.length > 0) {
    throw new Error(
      `This database is missing earlier schema changes. Run these from server/sql/ with psql, ` +
        `in order, then migrate again: ${missing.join(', ')}`
    );
  }
};

export const down: MigrationStep = async () => {};
