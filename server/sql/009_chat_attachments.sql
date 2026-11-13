-- Files in direct messages: photos, videos, audio and documents, kept in a private R2 bucket
-- (R2_CHAT_BUCKET_NAME). Run this BEFORE merging the server change. Safe to run more than once.

BEGIN;

-- One row per uploaded file. It starts 'pending' when the device is given somewhere to upload,
-- becomes 'sent' once a message carries it, and 'deleted' when that message is deleted (the file
-- is then removed from the bucket). Uploads never sent are removed after a few hours.
CREATE TABLE IF NOT EXISTS chat_attachments (
  id              UUID PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
  uploader_id     INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
  -- Set when sent. Unique: one file belongs to one message.
  message_id      BIGINT UNIQUE REFERENCES chat_messages (id) ON DELETE SET NULL,
  storage_key     VARCHAR(200) NOT NULL UNIQUE,
  kind            VARCHAR(16) NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'file')),
  name            VARCHAR(160) NOT NULL,
  mime            VARCHAR(127) NOT NULL,
  size            BIGINT NOT NULL CHECK (size > 0),
  width           INTEGER,
  height          INTEGER,
  duration_sec    INTEGER,
  status          VARCHAR(16) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily upload allowance per person.
CREATE INDEX IF NOT EXISTS idx_chat_attachments_uploader
  ON chat_attachments (uploader_id, created_at);

-- Finding uploads that were never sent.
CREATE INDEX IF NOT EXISTS idx_chat_attachments_pending
  ON chat_attachments (created_at) WHERE status = 'pending';

-- Messages can now carry any file, not only a photo.
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check
  CHECK (type IN ('text', 'image', 'file', 'call'));

COMMIT;
