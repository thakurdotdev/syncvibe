-- Songs a listener asked never to be recommended again. Run before deploying the server that
-- reads it. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS song_dislikes (
  user_id     INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
  song_ref_id INTEGER NOT NULL REFERENCES songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, song_ref_id)
);

COMMIT;
