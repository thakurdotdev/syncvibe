import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatError } from './chat.errors';
import {
  FILE_RULES,
  LIMITS,
  cleanFileName,
  contentDisposition,
  looksLike,
  parseUploadRequest,
  servedType,
} from './attachment.rules';

const rejects = (run: () => unknown) => assert.throws(run, ChatError);
const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part
    )
  );

test('file names lose folders, control and spoofing characters', () => {
  assert.equal(cleanFileName('../../etc/report.pdf'), 'report.pdf');
  assert.equal(cleanFileName('C:\\Users\\me\\notes.txt'), 'notes.txt');
  assert.equal(cleanFileName('  my   holiday\tphoto.JPG '), 'my holiday photo.JPG');
  // A right-to-left override would show "invoice‮fdp.exe" as "invoiceexe.pdf".
  assert.equal(cleanFileName('invoice\u202efdp.exe'), 'invoicefdp.exe');
  assert.equal(cleanFileName('what?<is>"this".md'), 'whatisthis.md');
  rejects(() => cleanFileName('no-extension'));
  rejects(() => cleanFileName('.hidden'));
  rejects(() => cleanFileName(42));
});

test('long names are shortened, keeping the extension', () => {
  const name = cleanFileName(`${'a'.repeat(300)}.pdf`);
  assert.ok([...name].length <= 120);
  assert.ok(name.endsWith('….pdf'));
});

test('only listed kinds of file can be uploaded, within their limits', () => {
  const photo = parseUploadRequest({ name: 'a.png', size: 1000, width: 800, height: 600 });
  assert.equal(photo.rule.kind, 'image');
  assert.equal(photo.rule.mime, 'image/png');
  assert.deepEqual([photo.width, photo.height], [800, 600]);

  const doc = parseUploadRequest({ name: 'Plan.PDF', size: 1000, width: 10, height: 10 });
  assert.equal(doc.rule.mime, 'application/pdf');
  assert.equal(doc.width, null, 'documents have no size on screen');

  for (const name of ['setup.exe', 'app.apk', 'page.html', 'icon.svg', 'run.sh', 'x.js']) {
    rejects(() => parseUploadRequest({ name, size: 10 }));
  }
  rejects(() => parseUploadRequest({ name: 'a.png', size: 0 }));
  rejects(() => parseUploadRequest({ name: 'a.png', size: -5 }));
  rejects(() => parseUploadRequest({ name: 'a.png', size: '10' }));
  rejects(() => parseUploadRequest({ name: 'a.png', size: LIMITS.image + 1 }));
  assert.ok(parseUploadRequest({ name: 'a.mp4', size: LIMITS.image + 1 }));
  rejects(() => parseUploadRequest({ name: 'a.mp4', size: LIMITS.video + 1 }));
});

test('no rule allows more than the overall limit', () => {
  for (const rule of Object.values(FILE_RULES)) assert.ok(rule.maxBytes <= LIMITS.max);
});

test('uploads must start the way their kind of file starts', () => {
  const ok = (ext: string, data: Uint8Array, complete = false) =>
    assert.ok(looksLike(FILE_RULES[ext]!, data, complete), `${ext} should pass`);
  const bad = (ext: string, data: Uint8Array, complete = false) =>
    assert.ok(!looksLike(FILE_RULES[ext]!, data, complete), `${ext} should fail`);

  ok('jpg', bytes([0xff, 0xd8, 0xff, 0xe0]));
  ok('png', bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]));
  ok('gif', bytes('GIF89a'));
  ok('webp', bytes('RIFF', [0, 0, 0, 0], 'WEBP'));
  ok('pdf', bytes('%PDF-1.7'));
  ok('mp4', bytes([0, 0, 0, 0x20], 'ftypisom'));
  ok('mov', bytes([0, 0, 0, 0x14], 'ftypqt  '));
  ok('mov', bytes([0, 0, 0, 0x08], 'wide'));
  ok('m4a', bytes([0, 0, 0, 0x20], 'ftypM4A '));
  ok('heic', bytes([0, 0, 0, 0x18], 'ftypheic'));
  ok('avif', bytes([0, 0, 0, 0x18], 'ftypavif'));
  ok('webm', bytes([0x1a, 0x45, 0xdf, 0xa3]));
  ok('mp3', bytes('ID3'));
  ok('mp3', bytes([0xff, 0xfb, 0x90]));
  ok('ogg', bytes('OggS'));
  ok('wav', bytes('RIFF', [0, 0, 0, 0], 'WAVE'));
  ok('flac', bytes('fLaC'));
  ok('docx', bytes([0x50, 0x4b, 0x03, 0x04]));
  ok('doc', bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  ok('7z', bytes([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));
  ok('gz', bytes([0x1f, 0x8b, 0x08]));
  const tar = new Uint8Array(512);
  tar.set(bytes('ustar'), 257);
  ok('tar', tar);

  // An HTML page or a program renamed to look harmless.
  bad('png', bytes('<!doctype html><script>'));
  bad('pdf', bytes('MZ', [0x90, 0]));
  bad('jpg', bytes([0x89], 'PNG'));
  bad('mp4', bytes([0, 0, 0, 0x18], 'ftypheic'), true);
  bad('heic', bytes([0, 0, 0, 0x20], 'ftypisom'));
  bad('docx', bytes('%PDF-'));
});

test('text files must be UTF-8 with no NUL bytes', () => {
  const text = (value: string) => new TextEncoder().encode(value);
  assert.ok(looksLike(FILE_RULES.txt!, text('héllo, wörld ✓'), true));
  assert.ok(looksLike(FILE_RULES.csv!, text('a,b\n1,2\n'), true));
  assert.ok(!looksLike(FILE_RULES.txt!, bytes('MZ', [0, 0, 0]), true));
  assert.ok(!looksLike(FILE_RULES.txt!, bytes([0xc3, 0x28]), true));

  // Read only in part: a character cut off at the end is fine, but not when it's the whole file.
  const cut = text('ok ✓').subarray(0, 4);
  assert.ok(looksLike(FILE_RULES.txt!, cut, false));
  assert.ok(!looksLike(FILE_RULES.txt!, cut, true));
});

test('downloads keep their name, safely quoted', () => {
  assert.equal(
    contentDisposition('attachment', 'report.pdf'),
    `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`
  );
  const header = contentDisposition('inline', 'résumé "final"; v2.pdf');
  assert.ok(header.startsWith('inline; filename="resume final v2.pdf"'));
  assert.ok(header.includes("filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22%3B%20v2.pdf"));
  assert.ok(contentDisposition('attachment', '写真.png').includes('filename="file.png"'));
});

test('text is always served as plain text', () => {
  assert.equal(servedType(FILE_RULES.md!), 'text/plain; charset=utf-8');
  assert.equal(servedType(FILE_RULES.json!), 'text/plain; charset=utf-8');
  assert.equal(servedType(FILE_RULES.pdf!), 'application/pdf');
});
