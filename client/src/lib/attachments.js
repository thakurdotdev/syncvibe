/**
 * Which files can go in a message, so a file the server would refuse is turned away the moment
 * it is picked. The server's rules (server/src/features/chat/attachment.rules.ts) are what
 * count; the app has the same list in app/lib/attachments.ts. Change all three together.
 */

const MB = 1024 * 1024;

export const LIMITS = {
  image: 25 * MB,
  video: 100 * MB,
  audio: 50 * MB,
  document: 50 * MB,
  archive: 100 * MB,
};

/** Files picked at once. Each becomes its own message. */
export const MAX_FILES_AT_ONCE = 10;

const IMAGE = { kind: 'image', max: LIMITS.image };
const VIDEO = { kind: 'video', max: LIMITS.video };
const AUDIO = { kind: 'audio', max: LIMITS.audio };
const DOCUMENT = { kind: 'file', max: LIMITS.document };
const ARCHIVE = { kind: 'file', max: LIMITS.archive };

const RULES = {
  jpg: IMAGE,
  jpeg: IMAGE,
  png: IMAGE,
  gif: IMAGE,
  webp: IMAGE,
  avif: IMAGE,
  heic: { kind: 'file', max: LIMITS.image },
  heif: { kind: 'file', max: LIMITS.image },
  mp4: VIDEO,
  m4v: VIDEO,
  mov: VIDEO,
  webm: VIDEO,
  '3gp': VIDEO,
  mkv: { kind: 'file', max: LIMITS.video },
  mp3: AUDIO,
  m4a: AUDIO,
  aac: AUDIO,
  ogg: AUDIO,
  oga: AUDIO,
  opus: AUDIO,
  wav: AUDIO,
  flac: AUDIO,
  pdf: DOCUMENT,
  txt: DOCUMENT,
  md: DOCUMENT,
  csv: DOCUMENT,
  json: DOCUMENT,
  log: DOCUMENT,
  rtf: DOCUMENT,
  doc: DOCUMENT,
  xls: DOCUMENT,
  ppt: DOCUMENT,
  docx: DOCUMENT,
  xlsx: DOCUMENT,
  pptx: DOCUMENT,
  odt: DOCUMENT,
  ods: DOCUMENT,
  odp: DOCUMENT,
  epub: DOCUMENT,
  zip: ARCHIVE,
  '7z': ARCHIVE,
  rar: ARCHIVE,
  gz: ARCHIVE,
  tgz: ARCHIVE,
  tar: ARCHIVE,
};

/** For the file picker. */
export const ACCEPT = Object.keys(RULES)
  .map((ext) => `.${ext}`)
  .join(',');

export const extensionOf = (name = '') => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
};

export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** `{ kind }` for a file that can be sent, or `{ error }` saying why not. */
export const checkFile = (file) => {
  const ext = extensionOf(file.name);
  const rule = RULES[ext];
  if (!rule) return { error: ext ? `.${ext} files can't be sent` : `${file.name} can't be sent` };
  if (file.size === 0) return { error: `${file.name} is empty` };
  if (file.size > rule.max) {
    return { error: `${file.name} is too large. The limit is ${formatBytes(rule.max)}.` };
  }
  return { kind: rule.kind };
};

/** "Photo", "Video", "Audio" or the file's name: for previews and quotes. */
export const attachmentLabel = (attachment) => {
  if (!attachment) return '';
  const kind = attachment.kind ?? 'image';
  if (kind === 'image') return 'Photo';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Audio';
  return attachment.name || 'File';
};

/** What a quote says about the message it quotes. */
export const replyLabel = (reply) =>
  reply.body ||
  (reply.hasAttachment
    ? attachmentLabel({ kind: reply.attachmentKind ?? 'image', name: reply.attachmentName })
    : 'Message');

/** A short type name for a file card: "PDF", "Word", "ZIP"… */
export const typeLabel = (name) => {
  const ext = extensionOf(name);
  const names = {
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

/** Which icon a file card shows. */
export const fileFamily = (name) => {
  const ext = extensionOf(name);
  if (['zip', '7z', 'rar', 'gz', 'tgz', 'tar'].includes(ext)) return 'archive';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'slides';
  if (['json'].includes(ext)) return 'code';
  if (['heic', 'heif'].includes(ext)) return 'image';
  if (['mkv'].includes(ext)) return 'video';
  return 'document';
};

/**
 * Files on the clipboard that should be attached. A screenshot or a copied picture comes with no
 * plain text; a copy from Word or Excel brings its text along with a picture of it, and then the
 * text is what the person meant, so nothing is attached.
 */
export const filesFromClipboard = (clipboard) => {
  const files = [...(clipboard?.files || [])];
  if (files.length === 0 || clipboard.getData('text/plain').trim()) return [];
  return files;
};

/** Whether a drag carries files (rather than text or a link). */
export const dragHasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');

/** Dropped folders, by name: they can't be sent as they are. */
export const droppedFolders = (dataTransfer) =>
  [...(dataTransfer?.items || [])]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry) => entry?.isDirectory)
    .map((entry) => entry.name);

// ── Getting a file ready ────────────────────────────────────────────────────

const MAX_PHOTO_SIDE = 2560;
const SHRINK_ABOVE_BYTES = 1.5 * MB;
const PHOTO_QUALITY = 0.85;

/**
 * Large JPEG photos are scaled down before they're sent, which makes them quicker to send and to
 * open. Other photos (PNG screenshots, GIFs, WebP that may be see-through) are sent as they are. Returns the file
 * to send and its size on screen.
 */
const preparePhoto = async (file) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file };
  }
  const { width, height } = bitmap;
  const shrinkable = file.type === 'image/jpeg';
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height));
  if (!shrinkable || (scale === 1 && file.size <= SHRINK_ABOVE_BYTES)) {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
  if (!blob || blob.size >= file.size) return { file, width, height };

  const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  return {
    file: new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified }),
    width: canvas.width,
    height: canvas.height,
  };
};

/** A video's or a song's size on screen and length, read from the file without playing it. */
const readMedia = (file, kind) =>
  new Promise((resolve) => {
    const element = document.createElement(kind === 'video' ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = (result) => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
      resolve(result);
    };
    const timer = setTimeout(() => done({}), 4000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      clearTimeout(timer);
      done({
        width: element.videoWidth || undefined,
        height: element.videoHeight || undefined,
        durationSec: Number.isFinite(element.duration) ? Math.round(element.duration) : undefined,
      });
    };
    element.onerror = () => {
      clearTimeout(timer);
      done({});
    };
    element.src = url;
  });

/** The file to upload and what the server is told about it. */
export const prepareFile = async (file, kind) => {
  if (kind === 'image') return preparePhoto(file);
  if (kind === 'video' || kind === 'audio') return { file, ...(await readMedia(file, kind)) };
  return { file };
};
