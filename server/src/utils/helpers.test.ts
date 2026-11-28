import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedInt, isCloudinaryUrl, likeContains } from './helpers';

test('only https addresses on our Cloudinary account count', () => {
  assert.equal(isCloudinaryUrl('https://res.cloudinary.com/ours/image/upload/a.jpg', 'ours'), true);
  for (const url of [
    'http://res.cloudinary.com/ours/a.jpg',
    'https://res.cloudinary.com/theirs/a.jpg',
    'https://evil.test/a.jpg?cloudinary.com',
    'https://res.cloudinary.com.evil.test/ours/a.jpg',
    'not a url',
  ]) {
    assert.equal(isCloudinaryUrl(url, 'ours'), false, url);
  }
});

test('LIKE wildcards in a search are taken literally', () => {
  assert.equal(likeContains('50%_\\'), '%50\\%\\_\\\\%');
});

test('query numbers stay within bounds', () => {
  assert.equal(boundedInt('500', 10, 100), 100);
  assert.equal(boundedInt('-3', 10, 100), 1);
  assert.equal(boundedInt('abc', 10, 100), 10);
  assert.equal(boundedInt(undefined, 10, 100), 10);
});
