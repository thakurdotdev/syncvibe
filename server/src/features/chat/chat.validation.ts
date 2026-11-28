import { invalid } from './chat.errors';
import type { LegacyPhoto } from '@/models/chat/message.model';

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
 * A photo from app versions that still upload to Cloudinary: only images in our own chat folder. Anything else would make the other person's device
 * fetch an address the sender chose, which gives away their IP and can track when they read it.
 */
export const parseAttachment = (
  value: unknown,
  cloudName = process.env.CLOUD_NAME
): LegacyPhoto | null => {
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

/** Where the GIF picker's files are. Other addresses are refused for the reason given above. */
const GIF_HOST = 'static.klipy.com';

/** A GIF picked from Klipy: only an animated .gif on its file host, with the size if known. */
export const parseGif = (value: unknown): LegacyPhoto => {
  const raw = value as { url?: unknown; width?: unknown; height?: unknown } | null;
  if (!raw || typeof raw !== 'object' || typeof raw.url !== 'string' || raw.url.length > 500) {
    throw invalid('Invalid GIF');
  }

  let url: URL;
  try {
    url = new URL(raw.url);
  } catch {
    throw invalid('Invalid GIF');
  }
  const ours =
    url.protocol === 'https:' &&
    url.hostname === GIF_HOST &&
    !url.username &&
    !url.password &&
    !url.port &&
    /^\/[A-Za-z0-9/_-]+\.gif$/.test(url.pathname);
  if (!ours) throw invalid('GIFs must come from the GIF picker');

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

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;

/** Words to look for in a conversation: trimmed, at least two characters, at most a hundred. */
export const parseSearch = (value: unknown): string => {
  const query = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if ([...query].length < MIN_SEARCH_LENGTH) {
    throw invalid(`Search for at least ${MIN_SEARCH_LENGTH} characters`);
  }
  return [...query].slice(0, MAX_SEARCH_LENGTH).join('');
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
