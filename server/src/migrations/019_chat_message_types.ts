import type { MigrationStep } from './types';

/**
 * GIFs and shared songs are kinds of message of their own, which the check from
 * sql/009_chat_attachments.sql didn't allow: every one was refused as it was stored. The check is
 * replaced with one that allows them too, so it still refuses anything else.
 */
const TYPES = ['text', 'image', 'file', 'call', 'gif', 'song'];

export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `ALTER TABLE chat_messages
       DROP CONSTRAINT IF EXISTS chat_messages_type_check,
       ADD CONSTRAINT chat_messages_type_check
         CHECK (type IN (${TYPES.map((type) => `'${type}'`).join(', ')}))`,
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `ALTER TABLE chat_messages
       DROP CONSTRAINT IF EXISTS chat_messages_type_check,
       ADD CONSTRAINT chat_messages_type_check CHECK (type IN ('text', 'image', 'file', 'call'))`,
    { transaction }
  );
};
