import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatError } from './chat.errors';
import {
  MAX_BODY_LENGTH,
  parseAttachment,
  parseBody,
  parseClientId,
  parseEmoji,
  parseGif,
  parseId,
  parseSearch,
  parsePageSize,
} from './chat.validation';
import { createRateLimiter } from '@/utils/rate-limiter';

const rejects = (run: () => unknown) => assert.throws(run, ChatError);

test('ids must be positive whole numbers', () => {
  assert.equal(parseId(42), 42);
  assert.equal(parseId('42'), 42);
  for (const bad of [0, -1, 1.5, '1e3', '4 2', '', null, undefined, {}, NaN, 2 ** 60]) {
    rejects(() => parseId(bad));
  }
});

test('client ids are short opaque tokens', () => {
  assert.equal(parseClientId('3f0c9a52-1b7e-4a55-9d3e-0a1b2c3d4e5f').length, 36);
  rejects(() => parseClientId('short'));
  rejects(() => parseClientId('has spaces in it'));
  rejects(() => parseClientId('x'.repeat(65)));
  rejects(() => parseClientId(12345678));
});

test('text is trimmed, stripped of control characters and capped', () => {
  assert.equal(parseBody('  hi\u0000 there\n'), 'hi there');
  assert.equal(parseBody('line one\nline two'), 'line one\nline two');
  assert.equal(parseBody('   '), null);
  assert.equal(parseBody(undefined), null);
  assert.equal(parseBody('x'.repeat(MAX_BODY_LENGTH))?.length, MAX_BODY_LENGTH);
  rejects(() => parseBody('x'.repeat(MAX_BODY_LENGTH + 1)));
  rejects(() => parseBody({ text: 'hi' }));
});

test('attachments must be photos in our own chat folder', () => {
  const ok = 'https://res.cloudinary.com/demo/image/upload/v1/chat/chat_6_1_ab.jpg';
  assert.deepEqual(parseAttachment({ url: ok }, 'demo'), { url: ok });
  assert.deepEqual(parseAttachment({ url: `${ok}?x=1#y`, width: 800, height: 600 }, 'demo'), {
    url: ok,
    width: 800,
    height: 600,
  });
  assert.equal(parseAttachment(null, 'demo'), null);

  for (const url of [
    'https://evil.example/chat/chat_1.jpg',
    'http://res.cloudinary.com/demo/image/upload/v1/chat/chat_1.jpg',
    'https://res.cloudinary.com/other/image/upload/v1/chat/chat_1.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1/profiles/profiles_1.jpg',
    'https://res.cloudinary.com.evil.example/demo/image/upload/v1/chat/chat_1.jpg',
    'https://user@res.cloudinary.com/demo/image/upload/v1/chat/chat_1.jpg',
    'blob:https://syncvibe.thakur.dev/e0205d66',
    'javascript:alert(1)',
  ]) {
    rejects(() => parseAttachment({ url }, 'demo'));
  }
  rejects(() => parseAttachment('https://x', 'demo'));
  // With no cloud configured nothing can be checked, so nothing is accepted.
  rejects(() => parseAttachment({ url: ok }, undefined));
});

test('reactions are a single emoji', () => {
  for (const emoji of ['👍', '❤️', '😂', '👨‍👩‍👧', '🇮🇳', '👍🏽', '1️⃣']) {
    assert.equal(parseEmoji(emoji), emoji);
  }
  assert.equal(parseEmoji(null), null);
  assert.equal(parseEmoji(''), null);
  for (const bad of ['ok', '1', '<b>', '👍 nice', ' ', 7, '👍'.repeat(20)]) {
    rejects(() => parseEmoji(bad));
  }
});

test('page size falls back to the default and is capped', () => {
  assert.equal(parsePageSize(undefined), 40);
  assert.equal(parsePageSize('25'), 25);
  assert.equal(parsePageSize('100000'), 100);
  assert.equal(parsePageSize('-3'), 40);
});

test('the rate limiter allows a burst, then refuses until the window ends', () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(allow('a', 0), true);
  assert.equal(allow('a', 10), true);
  assert.equal(allow('a', 20), false);
  assert.equal(allow('b', 20), true);
  assert.equal(allow('a', 1001), true);
});

test("GIFs are only .gif files on the picker's host", () => {
  const url = 'https://static.klipy.com/ii/925f17378dd1893b674a723c07535afe/f7/f9/eacpvEiQ.gif';
  assert.deepEqual(parseGif({ url }), { url });
  assert.deepEqual(parseGif({ url: `${url}?track=1#x`, width: 220, height: 160 }), {
    url,
    width: 220,
    height: 160,
  });
  // A size is kept only when both sides are sensible.
  assert.deepEqual(parseGif({ url, width: 220 }), { url });
  assert.deepEqual(parseGif({ url, width: -1, height: 160 }), { url });

  for (const bad of [
    null,
    url,
    { url: 'http://static.klipy.com/ii/a/b.gif' },
    { url: 'https://static.klipy.com.evil.test/ii/a/b.gif' },
    { url: 'https://evil.test/static.klipy.com/b.gif' },
    { url: 'https://user@static.klipy.com/ii/a/b.gif' },
    { url: 'https://static.klipy.com:8443/ii/a/b.gif' },
    { url: 'https://static.klipy.com/ii/a/b.mp4' },
    { url: `https://static.klipy.com/${'a'.repeat(500)}.gif` },
  ]) {
    rejects(() => parseGif(bad));
  }
});

test('a search is trimmed text of two to a hundred characters', () => {
  assert.equal(parseSearch('  see   you  '), 'see you');
  assert.equal(parseSearch('हम'), 'हम');
  assert.equal(parseSearch('x'.repeat(150)).length, 100);
  for (const bad of ['', ' a ', null, 42, ['ab']]) rejects(() => parseSearch(bad));
});
