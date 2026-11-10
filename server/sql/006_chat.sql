-- Direct messages, redesigned: conversations with per-member read and delivery positions, messages
-- that can't be stored twice, replies and reactions. Run this BEFORE merging the server change.
--
-- It also copies everything from the old `chats` / `chatmessage` tables, which are left untouched.
-- Safe to run more than once: a second run copies only what the first one hasn't. Run it again
-- right after the deploy finishes, to pick up anything sent through the old server in between.

BEGIN;

CREATE TABLE IF NOT EXISTS chat_conversations (
  id              BIGSERIAL PRIMARY KEY,
  type            VARCHAR(16) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct')),
  -- "<lower userid>:<higher userid>". Unique, so two people can only ever have one conversation,
  -- even when both start it at the same moment.
  direct_key      VARCHAR(48) UNIQUE,
  -- Orders the conversation list. Only ever moves forward.
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_chat_id  INTEGER UNIQUE
);

CREATE TABLE IF NOT EXISTS chat_members (
  conversation_id           BIGINT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
  user_id                   INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
  -- Everything up to and including this message has been read by / has reached this member.
  last_read_message_id      BIGINT NOT NULL DEFAULT 0,
  last_read_at              TIMESTAMPTZ,
  last_delivered_message_id BIGINT NOT NULL DEFAULT 0,
  last_delivered_at         TIMESTAMPTZ,
  joined_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members (user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                BIGSERIAL PRIMARY KEY,
  conversation_id   BIGINT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
  sender_id         INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
  -- Chosen by the sending device, so a message sent again after a lost reply isn't stored twice.
  client_id         VARCHAR(64) NOT NULL,
  type              VARCHAR(16) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'call')),
  body              TEXT,
  -- { url, width?, height? }
  attachment        JSONB,
  -- Calls: { outcome: 'missed' | 'completed' | 'rejected', durationSec? }
  meta              JSONB,
  reply_to_id       BIGINT REFERENCES chat_messages (id) ON DELETE SET NULL,
  edited_at         TIMESTAMPTZ,
  -- A deleted message keeps its row (replies still point at it) but loses its content.
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_message_id INTEGER UNIQUE,
  CONSTRAINT chat_messages_sender_client UNIQUE (sender_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages (conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id BIGINT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users (userid) ON DELETE CASCADE,
  emoji      VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One reaction per person per message; choosing another replaces it.
  PRIMARY KEY (message_id, user_id)
);

-- ── Copy the old data ───────────────────────────────────────────────────────

-- Chats between two accounts that both still exist. The rest already can't be opened.
INSERT INTO chat_conversations (type, direct_key, created_at, legacy_chat_id)
SELECT 'direct',
       LEAST(c.participants[1], c.participants[2]) || ':' ||
         GREATEST(c.participants[1], c.participants[2]),
       c.createdat,
       c.chatid
FROM chats c
WHERE array_length(c.participants, 1) = 2
  AND c.participants[1] <> c.participants[2]
  AND EXISTS (SELECT 1 FROM users u WHERE u.userid = c.participants[1])
  AND EXISTS (SELECT 1 FROM users u WHERE u.userid = c.participants[2])
ORDER BY c.chatid
ON CONFLICT DO NOTHING;

INSERT INTO chat_members (conversation_id, user_id, joined_at)
SELECT cv.id, p.user_id, cv.created_at
FROM chat_conversations cv
JOIN chats c ON c.chatid = cv.legacy_chat_id
CROSS JOIN LATERAL unnest(c.participants) AS p (user_id)
ON CONFLICT DO NOTHING;

-- In id order, so the new ids keep the order the messages were sent in.
INSERT INTO chat_messages
  (conversation_id, sender_id, client_id, type, body, attachment, meta, created_at,
   legacy_message_id)
SELECT cv.id,
       m.senderid,
       'legacy-' || m.messageid,
       CASE
         WHEN m.messagetype IN ('missed_call', 'completed_call', 'rejected_call') THEN 'call'
         WHEN m.fileurl LIKE 'https://res.cloudinary.com/%' THEN 'image'
         ELSE 'text'
       END,
       CASE
         WHEN m.messagetype IN ('missed_call', 'completed_call', 'rejected_call') THEN NULL
         ELSE NULLIF(BTRIM(m.content), '')
       END,
       CASE
         WHEN m.messagetype IN ('missed_call', 'completed_call', 'rejected_call') THEN NULL
         WHEN m.fileurl LIKE 'https://res.cloudinary.com/%'
           THEN jsonb_build_object('url', m.fileurl)
       END,
       CASE
         WHEN m.messagetype IN ('missed_call', 'completed_call', 'rejected_call') THEN
           jsonb_strip_nulls(jsonb_build_object(
             'outcome', split_part(m.messagetype, '_', 1),
             'durationSec', CASE WHEN m.content ~ '^[0-9]{1,6}$' THEN m.content::INTEGER END
           ))
       END,
       m.createdat,
       m.messageid
FROM chatmessage m
JOIN chat_conversations cv ON cv.legacy_chat_id = m.chatid
JOIN chat_members mem ON mem.conversation_id = cv.id AND mem.user_id = m.senderid
WHERE NOT m.isdeleted
  AND (
    m.messagetype IN ('missed_call', 'completed_call', 'rejected_call')
    OR NULLIF(BTRIM(m.content), '') IS NOT NULL
    -- A few old rows hold a browser "blob:" address that never was a real file.
    OR m.fileurl LIKE 'https://res.cloudinary.com/%'
  )
ORDER BY m.messageid
ON CONFLICT DO NOTHING;

-- Read up to the last message the old table marks as read; everything so far counts as delivered.
UPDATE chat_members mem
SET last_read_message_id = GREATEST(mem.last_read_message_id, seen.read_id),
    last_read_at = COALESCE(mem.last_read_at, seen.read_at),
    last_delivered_message_id = GREATEST(mem.last_delivered_message_id, seen.delivered_id),
    last_delivered_at = COALESCE(mem.last_delivered_at, seen.delivered_at)
FROM (
  SELECT nm.conversation_id,
         other.user_id,
         COALESCE(MAX(nm.id) FILTER (WHERE om.isread), 0) AS read_id,
         MAX(om.readat) FILTER (WHERE om.isread) AS read_at,
         MAX(nm.id) AS delivered_id,
         MAX(nm.created_at) AS delivered_at
  FROM chat_messages nm
  JOIN chatmessage om ON om.messageid = nm.legacy_message_id
  JOIN chat_members other
    ON other.conversation_id = nm.conversation_id AND other.user_id <> nm.sender_id
  GROUP BY nm.conversation_id, other.user_id
) seen
WHERE mem.conversation_id = seen.conversation_id
  AND mem.user_id = seen.user_id
  AND (mem.last_read_message_id < seen.read_id
       OR mem.last_delivered_message_id < seen.delivered_id);

UPDATE chat_conversations cv
SET last_message_at = latest.at
FROM (
  SELECT conversation_id, MAX(created_at) AS at FROM chat_messages GROUP BY conversation_id
) latest
WHERE cv.id = latest.conversation_id
  AND (cv.last_message_at IS NULL OR cv.last_message_at < latest.at);

COMMIT;
