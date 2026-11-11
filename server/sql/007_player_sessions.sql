-- Each user's own listening, shared by their devices: what is queued, what is playing and where.
-- Redis holds the live copy; this one outlasts it. Run before deploying the server that uses it.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS player_sessions (
  user_id    INTEGER PRIMARY KEY REFERENCES users (userid) ON DELETE CASCADE,
  -- Everything but the queue: current item, position, repeat, revisions, active device.
  core       JSONB NOT NULL,
  -- The queue, whole songs included (devices need their stream links).
  queue      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
