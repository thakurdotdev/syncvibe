/**
 * Which files can go in a message, so a file the server would refuse is turned away the moment
 * it is picked. The server's rules (server/src/features/chat/attachment.rules.ts) are what
 * count; the web has the same list in client/src/lib/attachments.js. Change all three together.
 */

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

const MB = 1024 * 1024;

export const LIMITS = {
  image: 25 * MB,
  video: 100 * MB,
  audio: 50 * MB,
  document: 50 * MB,
  archive: 100 * MB,
} as const;

/** Files picked at once. Each becomes its own message. */
export const MAX_FILES_AT_ONCE = 10;

interface Rule {
  kind: AttachmentKind;
  max: number;
  mime: string;
}

const rule = (kind: AttachmentKind, max: number, mime: string): Rule => ({ kind, max, mime });

const RULES: Record<string, Rule> = {
  jpg: rule('image', LIMITS.image, 'image/jpeg'),
  jpeg: rule('image', LIMITS.image, 'image/jpeg'),
  png: rule('image', LIMITS.image, 'image/png'),
  gif: rule('image', LIMITS.image, 'image/gif'),
  webp: rule('image', LIMITS.image, 'image/webp'),
  avif: rule('image', LIMITS.image, 'image/avif'),
  heic: rule('file', LIMITS.image, 'image/heic'),
  heif: rule('file', LIMITS.image, 'image/heif'),
  mp4: rule('video', LIMITS.video, 'video/mp4'),
  m4v: rule('video', LIMITS.video, 'video/mp4'),
  mov: rule('video', LIMITS.video, 'video/quicktime'),
  webm: rule('video', LIMITS.video, 'video/webm'),
  '3gp': rule('video', LIMITS.video, 'video/3gpp'),
  mkv: rule('file', LIMITS.video, 'video/x-matroska'),
  mp3: rule('audio', LIMITS.audio, 'audio/mpeg'),
  m4a: rule('audio', LIMITS.audio, 'audio/mp4'),
  aac: rule('audio', LIMITS.audio, 'audio/aac'),
  ogg: rule('audio', LIMITS.audio, 'audio/ogg'),
  oga: rule('audio', LIMITS.audio, 'audio/ogg'),
  opus: rule('audio', LIMITS.audio, 'audio/ogg'),
  wav: rule('audio', LIMITS.audio, 'audio/wav'),
  flac: rule('audio', LIMITS.audio, 'audio/flac'),
  pdf: rule('file', LIMITS.document, 'application/pdf'),
  txt: rule('file', LIMITS.document, 'text/plain'),
  md: rule('file', LIMITS.document, 'text/markdown'),
  csv: rule('file', LIMITS.document, 'text/csv'),
  json: rule('file', LIMITS.document, 'application/json'),
  log: rule('file', LIMITS.document, 'text/plain'),
  rtf: rule('file', LIMITS.document, 'application/rtf'),
  doc: rule('file', LIMITS.document, 'application/msword'),
  xls: rule('file', LIMITS.document, 'application/vnd.ms-excel'),
  ppt: rule('file', LIMITS.document, 'application/vnd.ms-powerpoint'),
  docx: rule(
    'file',
    LIMITS.document,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ),
  xlsx: rule(
    'file',
    LIMITS.document,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ),
  pptx: rule(
    'file',
    LIMITS.document,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ),
  odt: rule('file', LIMITS.document, 'application/vnd.oasis.opendocument.text'),
  ods: rule('file', LIMITS.document, 'application/vnd.oasis.opendocument.spreadsheet'),
  odp: rule('file', LIMITS.document, 'application/vnd.oasis.opendocument.presentation'),
  epub: rule('file', LIMITS.document, 'application/epub+zip'),
  zip: rule('file', LIMITS.archive, 'application/zip'),
  '7z': rule('file', LIMITS.archive, 'application/x-7z-compressed'),
  rar: rule('file', LIMITS.archive, 'application/vnd.rar'),
  gz: rule('file', LIMITS.archive, 'application/gzip'),
  tgz: rule('file', LIMITS.archive, 'application/gzip'),
  tar: rule('file', LIMITS.archive, 'application/x-tar'),
};

export const extensionOf = (name = ''): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * The name to send a file under. Some providers (Google Drive, for one) name files without an
 * extension; the type they report then supplies it, so the file isn't refused for having none.
 */
export const nameWithExtension = (name: string, mimeType?: string | null): string => {
  if (RULES[extensionOf(name)]) return name;
  const type = mimeType?.toLowerCase().split(';')[0]?.trim();
  const ext = type ? Object.keys(RULES).find((key) => RULES[key]!.mime === type) : undefined;
  return ext ? `${name}.${ext}` : name;
};

/** The type a file is stored and opened as, from its extension. */
export const mimeOf = (name: string): string =>
  RULES[extensionOf(name)]?.mime ?? 'application/octet-stream';

export const formatBytes = (bytes = 0): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
};

export const formatDuration = (seconds?: number | null): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** `{ kind }` for a file that can be sent, or `{ error }` saying why not. */
export const checkFile = (
  name: string,
  size: number
): { kind: AttachmentKind; error?: undefined } | { kind?: undefined; error: string } => {
  const ext = extensionOf(name);
  const found = RULES[ext];
  if (!found) return { error: ext ? `.${ext} files can't be sent` : `${name} can't be sent` };
  if (!size) return { error: `${name} is empty` };
  if (size > found.max) {
    return { error: `${name} is too large. The limit is ${formatBytes(found.max)}.` };
  }
  return { kind: found.kind };
};

/** "Photo", "Video", "Audio" or the file's name: for previews and quotes. */
export const attachmentLabel = (
  attachment: { kind?: AttachmentKind; name?: string | null } | null | undefined
): string => {
  if (!attachment) return '';
  const kind = attachment.kind ?? 'image';
  if (kind === 'image') return 'Photo';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Audio';
  return attachment.name || 'File';
};

/** What a quote says about the message it quotes. */
export const replyLabel = (reply: {
  body: string | null;
  hasAttachment: boolean;
  attachmentKind?: AttachmentKind | null;
  attachmentName?: string | null;
}): string =>
  reply.body ||
  (reply.hasAttachment
    ? attachmentLabel({ kind: reply.attachmentKind ?? 'image', name: reply.attachmentName })
    : 'Message');

/** A short type name for a file card: "PDF", "Word", "ZIP"… */
export const typeLabel = (name: string): string => {
  const ext = extensionOf(name);
  const names: Record<string, string> = {
    doc: 'Word',
    docx: 'Word',
    odt: 'Document',
    rtf: 'Document',
    xls: 'Excel',
    xlsx: 'Excel',
    ods: 'Spreadsheet',
    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    odp: 'Presentation',
    md: 'Markdown',
    txt: 'Text',
    log: 'Text',
    epub: 'eBook',
  };
  return names[ext] ?? ext.toUpperCase();
};

/** Which icon a file card shows (MaterialCommunityIcons). */
export const fileIcon = (name: string, kind?: AttachmentKind): string => {
  if (kind === 'audio') return 'file-music-outline';
  const ext = extensionOf(name);
  if (ext === 'pdf') return 'file-pdf-box';
  if (['zip', '7z', 'rar', 'gz', 'tgz', 'tar'].includes(ext)) return 'folder-zip-outline';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'file-excel-outline';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'file-powerpoint-outline';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'file-word-outline';
  if (['heic', 'heif'].includes(ext)) return 'file-image-outline';
  if (ext === 'mkv') return 'file-video-outline';
  if (ext === 'json') return 'code-json';
  return 'file-document-outline';
};
