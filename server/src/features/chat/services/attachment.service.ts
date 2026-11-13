import { randomUUID } from 'node:crypto';
import { Op, fn, col, type Transaction } from 'sequelize';
import { ChatAttachment } from '@/models/index';
import type { StoredFile } from '@/models/chat/message.model';
import { createRateLimiter } from '@/utils/rate-limiter';
import {
  FILE_RULES,
  LIMITS,
  SNIFF_BYTES,
  extensionOf,
  looksLike,
  parseUploadRequest,
} from '../attachment.rules';
import { ChatError, invalid, notFound } from '../chat.errors';
import type { FileAttachmentDto } from '../chat.types';
import { parseId } from '../chat.validation';
import {
  attachmentsEnabled,
  inspect,
  readStart,
  removeObject,
  signUpload,
} from './attachment.storage';
import { requireMembers } from './conversation.service';
import { presentFile } from './message.presenter';

/**
 * Files in messages. A device asks for somewhere to upload (`createUpload`), uploads straight to
 * the private bucket, then sends a message naming the upload. Before the message is stored the
 * server checks the bytes that arrived (`prepareAttachment`); a file that isn't what it claims is
 * removed. Links to read a file are signed only for the conversation's members.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Uploads not sent by then are removed, file and all. */
const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000;

const allowUpload = createRateLimiter({ limit: 30, windowMs: 60_000 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseAttachmentId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value)) throw invalid('Invalid attachment');
  return value.toLowerCase();
};

const requireEnabled = () => {
  if (!attachmentsEnabled()) {
    throw new ChatError('UNAVAILABLE', "Files can't be sent right now. Try again later.");
  }
};

const gone = () => new ChatError('GONE', 'This file has to be uploaded again');

const stored = (row: ChatAttachment): StoredFile => ({
  id: row.id,
  key: row.storageKey,
  kind: row.kind,
  name: row.name,
  mime: row.mime,
  size: row.size,
  ...(row.width && row.height ? { width: row.width, height: row.height } : {}),
  ...(row.durationSec ? { durationSec: row.durationSec } : {}),
});

// ── Uploading ───────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

const checkAllowance = async (userId: number, size: number) => {
  const [pending, today] = await Promise.all([
    ChatAttachment.count({ where: { uploaderId: userId, status: 'pending' } }),
    ChatAttachment.findOne({
      where: { uploaderId: userId, createdAt: { [Op.gte]: new Date(Date.now() - DAY_MS) } },
      attributes: [
        [fn('COUNT', col('id')), 'files'],
        [fn('COALESCE', fn('SUM', col('size')), 0), 'bytes'],
      ],
      raw: true,
    }) as unknown as Promise<{ files: string | number; bytes: string | number } | null>,
  ]);

  if (pending >= LIMITS.pending) {
    throw new ChatError('RATE_LIMITED', 'Wait for your other files to finish sending');
  }
  if (Number(today?.files ?? 0) >= LIMITS.dailyFiles) {
    throw new ChatError('RATE_LIMITED', "You've sent a lot of files today. Try again tomorrow.");
  }
  if (Number(today?.bytes ?? 0) + size > LIMITS.dailyBytes) {
    throw new ChatError(
      'RATE_LIMITED',
      `You can send up to ${LIMITS.dailyBytes / MB / 1024} GB of files a day. Try again later.`
    );
  }
};

/** Checks the file against the rules and gives the device a link to upload exactly that file. */
export const createUpload = async (
  userId: number,
  conversationIdInput: unknown,
  input: Record<string, unknown>
) => {
  requireEnabled();
  const conversationId = parseId(conversationIdInput, 'conversationId');
  const request = parseUploadRequest(input);
  await requireMembers(conversationId, userId);
  if (!allowUpload(userId)) {
    throw new ChatError('RATE_LIMITED', "You're sending files too fast. Wait a moment.");
  }
  await checkAllowance(userId, request.size);

  const id = randomUUID();
  const row = await ChatAttachment.create({
    id,
    conversationId,
    uploaderId: userId,
    storageKey: `chat/${conversationId}/${id}`,
    kind: request.rule.kind,
    name: request.name,
    mime: request.rule.mime,
    size: request.size,
    width: request.width,
    height: request.height,
    durationSec: request.durationSec,
  });

  const upload = await signUpload(row.storageKey, row.mime, row.size);
  return {
    attachment: { id, kind: row.kind, name: row.name, mime: row.mime, size: row.size },
    upload: { method: 'PUT' as const, ...upload },
  };
};

const discard = async (row: ChatAttachment) => {
  await removeObject(row.storageKey).catch((error: unknown) =>
    console.error('Removing a chat upload failed:', error)
  );
  await row.update({ status: 'deleted' });
};

/**
 * What arrived in the bucket must be the file that was announced: the same size, and starting
 * the way that kind of file starts. Anything else is removed.
 */
const verifyUpload = async (row: ChatAttachment): Promise<void> => {
  const head = await inspect(row.storageKey);
  if (!head) throw gone();
  const rule = FILE_RULES[extensionOf(row.name)];
  if (!rule || head.size !== row.size) {
    await discard(row);
    throw gone();
  }
  const start = await readStart(row.storageKey, SNIFF_BYTES);
  if (!looksLike(rule, start, row.size <= SNIFF_BYTES)) {
    await discard(row);
    throw invalid(`${row.name} isn't a real .${extensionOf(row.name)} file`);
  }
};

/**
 * The upload a message is about to carry, checked. Only its uploader can send it, only in the
 * conversation it was uploaded to. A file already sent is returned as it is: the device may be
 * sending the same message again, which `claimAttachment` sorts out.
 */
export const prepareAttachment = async (
  userId: number,
  conversationId: number,
  attachmentIdInput: unknown
): Promise<StoredFile> => {
  requireEnabled();
  const id = parseAttachmentId(attachmentIdInput);
  const row = await ChatAttachment.findOne({
    where: { id, uploaderId: userId, conversationId },
  });
  if (!row || row.status === 'deleted') throw gone();
  if (row.status === 'pending') await verifyUpload(row);
  return stored(row);
};

/** Ties the file to the message just stored. A file belongs to one message only. */
export const claimAttachment = async (
  attachmentId: string,
  messageId: number,
  transaction: Transaction
): Promise<void> => {
  const [claimed] = await ChatAttachment.update(
    { status: 'sent', messageId },
    { where: { id: attachmentId, status: 'pending', messageId: null }, transaction }
  );
  if (!claimed) throw invalid('This file was already sent');
};

// ── Reading and removing ────────────────────────────────────────────────────

/** Fresh links, for a device whose links ran out. Members only; an unsent upload, its uploader only. */
export const getAttachment = async (
  userId: number,
  attachmentIdInput: unknown
): Promise<FileAttachmentDto> => {
  const id = parseAttachmentId(attachmentIdInput);
  const row = await ChatAttachment.findByPk(id);
  if (!row || row.status === 'deleted') throw notFound('File');
  if (row.status === 'pending' && row.uploaderId !== userId) throw notFound('File');
  try {
    await requireMembers(row.conversationId, userId);
  } catch {
    throw notFound('File');
  }
  return presentFile(stored(row));
};

/** The uploader changed their mind before sending it. */
export const cancelUpload = async (userId: number, attachmentIdInput: unknown): Promise<void> => {
  const id = parseAttachmentId(attachmentIdInput);
  const row = await ChatAttachment.findOne({
    where: { id, uploaderId: userId, status: 'pending' },
  });
  if (row) await discard(row);
};

/** The message carrying it was deleted for everyone: so is the file. */
export const removeAttachmentOf = async (messageId: number): Promise<void> => {
  const row = await ChatAttachment.findOne({ where: { messageId, status: 'sent' } });
  if (row) await discard(row);
};

/** Removes uploads nobody sent. Runs now and then; a few at a time is plenty. */
export const sweepAbandonedUploads = async (): Promise<number> => {
  if (!attachmentsEnabled()) return 0;
  const rows = await ChatAttachment.findAll({
    where: { status: 'pending', createdAt: { [Op.lt]: new Date(Date.now() - ABANDONED_AFTER_MS) } },
    order: [['createdAt', 'ASC']],
    limit: 200,
  });
  for (const row of rows) await discard(row);
  return rows.length;
};

const SWEEP_EVERY_MS = 60 * 60 * 1000;

export const startUploadSweeper = (): void => {
  const run = () =>
    sweepAbandonedUploads().catch((error) =>
      console.error('Removing abandoned chat uploads failed:', error)
    );
  setTimeout(run, 60_000).unref();
  setInterval(run, SWEEP_EVERY_MS).unref();
};
