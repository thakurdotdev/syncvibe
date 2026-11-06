-- Editor-made playlists: which songs belong together. Play-next uses them when
-- RECO_ENGINE=hybrid. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS editorial_playlists (
  id                 VARCHAR(255) PRIMARY KEY,
  name               VARCHAR(500),
  owner              VARCHAR(255),
  -- Most songs share one artist, so it says little about which songs go together.
  "isSingleArtist"   BOOLEAN NOT NULL DEFAULT FALSE,
  "fetchedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS editorial_playlist_songs (
  "playlistId"       VARCHAR(255) NOT NULL REFERENCES editorial_playlists (id) ON DELETE CASCADE,
  "songId"           VARCHAR(255) NOT NULL,
  position           INTEGER NOT NULL,
  PRIMARY KEY ("playlistId", "songId")
);

CREATE INDEX IF NOT EXISTS idx_editorial_playlist_songs_song
  ON editorial_playlist_songs ("songId");

COMMIT;
