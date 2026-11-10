import { invalid } from './chat.errors';
import type { AttachmentDto } from './chat.types';

export const MAX_BODY_LENGTH = 2000;
export const DEFAULT_PAGE_SIZE = 40;
export const MAX_PAGE_SIZE = 100;

const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_IMAGE_SIDE = 20000;

export const parseId = (value: unknown, name = 'id'): number => {
  const id = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw invalid(`Invalid ${name}`);
  }
  return id;
};

export const parseOptionalId = (value: unknown, name = 'id'): number | null =>
  value == null || value === '' ? null : parseId(value, name);

export const parseClientId = (value: unknown): string => {
  if (typeof value !== 'string' || !CLIENT_ID.test(value)) throw invalid('Invalid clientId');
  return value;
};

/** Trimmed text with control characters removed (new lines and tabs stay), or null if empty. */
export const parseBody = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== 'string') throw invalid('Message text must be a string');
  const body = [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code !== 0x7f);
    })
    .join('')
    .trim();
  if (!body) return null;
  if (body.length > MAX_BODY_LENGTH) {
    throw invalid(`Messages can be up to ${MAX_BODY_LENGTH} characters`);
  }
  return body;
};

const parseSide = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_SIDE
    ? value
    : undefined;

/**
 * Only images uploaded to our own chat folder. Anything else would make the other person's device
 * fetch an address the sender chose, which gives away their IP and can track when they read it.
 */
export const parseAttachment = (
  value: unknown,
  cloudName = process.env.CLOUD_NAME
): AttachmentDto | null => {
  if (value == null) return null;
  const raw = value as { url?: unknown; width?: unknown; height?: unknown };
  if (typeof raw !== 'object' || typeof raw.url !== 'string' || raw.url.length > 500) {
    throw invalid('Invalid attachment');
  }

  let url: URL;
  try {
    url = new URL(raw.url);
  } catch {
    throw invalid('Invalid attachment');
  }

  const ours =
    Boolean(cloudName) &&
    url.protocol === 'https:' &&
    url.hostname === 'res.cloudinary.com' &&
    !url.username &&
    !url.port &&
    url.pathname.startsWith(`/${cloudName}/image/upload/`) &&
    url.pathname.includes('/chat/chat_');
  if (!ours) throw invalid('Attachments must be photos uploaded from SyncVibe');

  const width = parseSide(raw.width);
  const height = parseSide(raw.height);
  return {
    url: `${url.origin}${url.pathname}`,
    ...(width && height ? { width, height } : {}),
  };
};

const EMOJI_PARTS = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;
const EMOJI_CORE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/** One emoji (flags, skin tones and joined sequences included), or null to remove the reaction. */
export const parseEmoji = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  if (
    typeof value !== 'string' ||
    value.length > 32 ||
    !EMOJI_PARTS.test(value) ||
    !EMOJI_CORE.test(value)
  ) {
    throw invalid('Reactions must be a single emoji');
  }
  return value;
};

export const parsePageSize = (value: unknown): number => {
  const size = Number(value);
  if (!Number.isInteger(size) || size <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(size, MAX_PAGE_SIZE);
};

export const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
