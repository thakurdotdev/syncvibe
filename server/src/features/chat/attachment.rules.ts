import type { AttachmentKind } from '@/models/chat/attachment.model';
import { invalid } from './chat.errors';

/**
 * Which files can be sent in messages. The extension picks the rule; the type stored and served
 * comes from the rule, never from the device; and the first bytes of the upload must look like
 * that kind of file (see `looksLike`) before a message may carry it. Anything not listed here,
 * such as programs, web pages and SVGs, can't be sent.
 */

const MB = 1024 * 1024;

type Signature =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'avif'
  | 'heic'
  | 'mp4'
  | 'quicktime'
  | 'ebml'
  | 'mp3'
  | 'aac'
  | 'ogg'
  | 'wav'
  | 'flac'
  | 'pdf'
  | 'zip'
  | 'ole'
  | 'rtf'
  | 'text'
  | '7z'
  | 'rar'
  | 'gzip'
  | 'tar';

export interface FileRule {
  /** Stored as the object's type and served with it. */
  mime: string;
  kind: AttachmentKind;
  maxBytes: number;
  signature: Signature;
  /** Opens in a browser tab or player (photos, video, audio, PDF and plain text). */
  viewable: boolean;
}

const rule = (
  mime: string,
  kind: AttachmentKind,
  maxBytes: number,
  signature: Signature,
  viewable = kind !== 'file'
): FileRule => ({ mime, kind, maxBytes, signature, viewable });

export const LIMITS = {
  image: 25 * MB,
  video: 100 * MB,
  audio: 50 * MB,
  document: 50 * MB,
  archive: 100 * MB,
  /** The largest any file can be. */
  max: 100 * MB,
  /** Per person, over the last 24 hours. */
  dailyBytes: 1024 * MB,
  dailyFiles: 300,
  /** Uploads started but not yet sent, per person. */
  pending: 20,
} as const;

export const FILE_RULES: Readonly<Record<string, FileRule>> = {
  // Photos
  jpg: rule('image/jpeg', 'image', LIMITS.image, 'jpeg'),
  jpeg: rule('image/jpeg', 'image', LIMITS.image, 'jpeg'),
  png: rule('image/png', 'image', LIMITS.image, 'png'),
  gif: rule('image/gif', 'image', LIMITS.image, 'gif'),
  webp: rule('image/webp', 'image', LIMITS.image, 'webp'),
  avif: rule('image/avif', 'image', LIMITS.image, 'avif'),
  // Most browsers can't show HEIC, so it is sent as a file to download.
  heic: rule('image/heic', 'file', LIMITS.image, 'heic'),
  heif: rule('image/heif', 'file', LIMITS.image, 'heic'),

  // Video
  mp4: rule('video/mp4', 'video', LIMITS.video, 'mp4'),
  m4v: rule('video/mp4', 'video', LIMITS.video, 'mp4'),
  mov: rule('video/quicktime', 'video', LIMITS.video, 'quicktime'),
  webm: rule('video/webm', 'video', LIMITS.video, 'ebml'),
  '3gp': rule('video/3gpp', 'video', LIMITS.video, 'mp4'),
  mkv: rule('video/x-matroska', 'file', LIMITS.video, 'ebml'),

  // Audio
  mp3: rule('audio/mpeg', 'audio', LIMITS.audio, 'mp3'),
  m4a: rule('audio/mp4', 'audio', LIMITS.audio, 'mp4'),
  aac: rule('audio/aac', 'audio', LIMITS.audio, 'aac'),
  ogg: rule('audio/ogg', 'audio', LIMITS.audio, 'ogg'),
  oga: rule('audio/ogg', 'audio', LIMITS.audio, 'ogg'),
  opus: rule('audio/ogg', 'audio', LIMITS.audio, 'ogg'),
  wav: rule('audio/wav', 'audio', LIMITS.audio, 'wav'),
  flac: rule('audio/flac', 'audio', LIMITS.audio, 'flac'),

  // Documents
  pdf: rule('application/pdf', 'file', LIMITS.document, 'pdf', true),
  txt: rule('text/plain', 'file', LIMITS.document, 'text', true),
  md: rule('text/markdown', 'file', LIMITS.document, 'text', true),
  csv: rule('text/csv', 'file', LIMITS.document, 'text', true),
  json: rule('application/json', 'file', LIMITS.document, 'text', true),
  log: rule('text/plain', 'file', LIMITS.document, 'text', true),
  rtf: rule('application/rtf', 'file', LIMITS.document, 'rtf'),
  doc: rule('application/msword', 'file', LIMITS.document, 'ole'),
  xls: rule('application/vnd.ms-excel', 'file', LIMITS.document, 'ole'),
  ppt: rule('application/vnd.ms-powerpoint', 'file', LIMITS.document, 'ole'),
  docx: rule(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'file',
    LIMITS.document,
    'zip'
  ),
  xlsx: rule(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'file',
    LIMITS.document,
    'zip'
  ),
  pptx: rule(
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'file',
    LIMITS.document,
    'zip'
  ),
  odt: rule('application/vnd.oasis.opendocument.text', 'file', LIMITS.document, 'zip'),
  ods: rule('application/vnd.oasis.opendocument.spreadsheet', 'file', LIMITS.document, 'zip'),
  odp: rule('application/vnd.oasis.opendocument.presentation', 'file', LIMITS.document, 'zip'),
  epub: rule('application/epub+zip', 'file', LIMITS.document, 'zip'),

  // Archives
  zip: rule('application/zip', 'file', LIMITS.archive, 'zip'),
  '7z': rule('application/x-7z-compressed', 'file', LIMITS.archive, '7z'),
  rar: rule('application/vnd.rar', 'file', LIMITS.archive, 'rar'),
  gz: rule('application/gzip', 'file', LIMITS.archive, 'gzip'),
  tgz: rule('application/gzip', 'file', LIMITS.archive, 'gzip'),
  tar: rule('application/x-tar', 'file', LIMITS.archive, 'tar'),
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_RULES);

const MAX_NAME_LENGTH = 120;
const MAX_SIDE = 20000;
const MAX_DURATION_SEC = 24 * 60 * 60;

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * The name others see and download it as: no folders, control characters or characters that
 * aren't allowed in file names, and short enough to show, keeping its extension.
 */
export const cleanFileName = (value: unknown): string => {
  if (typeof value !== 'string') throw invalid('Invalid file name');
  const base = value.split(/[\\/]/).pop() ?? '';
  const cleaned = [...base.replace(/\s/g, ' ')]
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code <= 0x9f);
    })
    .join('')
    .replace(/[<>:"|?*\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');

  const ext = extensionOf(cleaned);
  if (!cleaned || !ext) throw invalid('Files need a name with an extension, like report.pdf');
  if ([...cleaned].length <= MAX_NAME_LENGTH) return cleaned;

  const stem = Array.from(cleaned.slice(0, cleaned.length - ext.length - 1));
  return `${stem
    .slice(0, MAX_NAME_LENGTH - ext.length - 2)
    .join('')
    .trimEnd()}….${ext}`;
};

const readableSize = (bytes: number) =>
  bytes >= MB ? `${Math.round(bytes / MB)} MB` : `${Math.round(bytes / 1024)} KB`;

const optionalInt = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max ? value : null;

export interface UploadRequest {
  name: string;
  ext: string;
  rule: FileRule;
  size: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/** What a device asks to upload, checked against the rules before it is given anywhere to put it. */
export const parseUploadRequest = (input: Record<string, unknown>): UploadRequest => {
  const name = cleanFileName(input.name);
  const ext = extensionOf(name);
  const fileRule = FILE_RULES[ext];
  if (!fileRule) throw invalid(`.${ext} files can't be sent`);

  const size = input.size;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) {
    throw invalid('This file is empty');
  }
  if (size > fileRule.maxBytes) {
    throw invalid(`${name} is too large. The limit is ${readableSize(fileRule.maxBytes)}.`);
  }

  const visual = fileRule.kind === 'image' || fileRule.kind === 'video';
  const width = visual ? optionalInt(input.width, MAX_SIDE) : null;
  const height = visual ? optionalInt(input.height, MAX_SIDE) : null;
  const timed = fileRule.kind === 'video' || fileRule.kind === 'audio';
  return {
    name,
    ext,
    rule: fileRule,
    size,
    width: width && height ? width : null,
    height: width && height ? height : null,
    durationSec: timed ? optionalInt(input.durationSec, MAX_DURATION_SEC) : null,
  };
};

// ── What the bytes say ──────────────────────────────────────────────────────

/** Enough of the start of a file to recognise every signature below, tar's included. */
export const SNIFF_BYTES = 4096;

const ascii = (bytes: Uint8Array, offset: number, text: string) =>
  bytes.length >= offset + text.length &&
  [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));

const startsWith = (bytes: Uint8Array, prefix: number[], offset = 0) =>
  bytes.length >= offset + prefix.length && prefix.every((byte, i) => bytes[offset + i] === byte);

/** The brand of an ISO media file (MP4, MOV, HEIC, AVIF…), from its first box. */
const isoBrand = (bytes: Uint8Array): string | null =>
  ascii(bytes, 4, 'ftyp') && bytes.length >= 12
    ? String.fromCharCode(...bytes.subarray(8, 12))
    : null;

const IMAGE_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

/**
 * Text: valid UTF-8 with no NUL bytes. Only the start is read, so a character cut in half at the
 * end is allowed.
 */
const isText = (bytes: Uint8Array, complete: boolean): boolean => {
  if (bytes.includes(0)) return false;
  let end = bytes.length;
  if (!complete) {
    // Step back over a last character that may continue past what was read.
    let back = 0;
    while (back < 3 && end - back - 1 >= 0 && (bytes[end - back - 1]! & 0xc0) === 0x80) back++;
    const lead = end - back - 1;
    if (lead >= 0 && bytes[lead]! >= 0xc0) end = lead;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end));
    return true;
  } catch {
    return false;
  }
};

const MATCHERS: Record<Signature, (bytes: Uint8Array, complete: boolean) => boolean> = {
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: (b) => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a'),
  webp: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'),
  avif: (b) => AVIF_BRANDS.has(isoBrand(b) ?? ''),
  heic: (b) => IMAGE_BRANDS.has(isoBrand(b) ?? ''),
  mp4: (b) => {
    const brand = isoBrand(b);
    return brand != null && !IMAGE_BRANDS.has(brand) && !AVIF_BRANDS.has(brand);
  },
  // Older QuickTime files may start with another box than ftyp.
  quicktime: (b) =>
    MATCHERS.mp4(b, true) ||
    ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((box) => ascii(b, 4, box)),
  ebml: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  mp3: (b) => ascii(b, 0, 'ID3') || (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0),
  aac: (b) => ascii(b, 0, 'ID3') || (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xf6) === 0xf0),
  ogg: (b) => ascii(b, 0, 'OggS'),
  wav: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE'),
  flac: (b) => ascii(b, 0, 'fLaC'),
  pdf: (b) => ascii(b, 0, '%PDF-'),
  // A normal archive, or an empty one.
  zip: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]),
  ole: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  rtf: (b) => ascii(b, 0, '{\\rtf'),
  text: isText,
  '7z': (b) => startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
  rar: (b) => ascii(b, 0, 'Rar!\x1a\x07'),
  gzip: (b) => startsWith(b, [0x1f, 0x8b]),
  tar: (b) => ascii(b, 257, 'ustar'),
};

/**
 * Whether the start of an upload is the kind of file its extension says. `complete` is true when
 * `bytes` is the whole file.
 */
export const looksLike = (fileRule: FileRule, bytes: Uint8Array, complete: boolean): boolean =>
  MATCHERS[fileRule.signature](bytes, complete);

// ── Serving ─────────────────────────────────────────────────────────────────

/**
 * A Content-Disposition header that every browser reads: a plain ASCII name, and the real one
 * encoded for those that understand it (RFC 6266).
 */
export const contentDisposition = (type: 'inline' | 'attachment', name: string): string => {
  const ascii = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["\\%;]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // A name written only in other scripts keeps just its extension.
  const fallback = ascii && !ascii.startsWith('.') ? ascii : `file.${extensionOf(name) || 'bin'}`;
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

/** Text is shown as plain text in the browser whatever it holds, so nothing in it can run. */
export const servedType = (fileRule: FileRule): string =>
  fileRule.signature === 'text' ? 'text/plain; charset=utf-8' : fileRule.mime;
