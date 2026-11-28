import assert from 'node:assert/strict';
import { test } from 'node:test';
import { songCover, songText } from './chat.songs';

test('a shared song reads as its name and artists, unescaped', () => {
  assert.equal(
    songText({ name: 'Tum Hi Ho &amp; More', artistNames: 'Arijit Singh, Mithoon' }),
    '🎵 Tum Hi Ho & More · Arijit Singh, Mithoon'
  );
  assert.equal(songText({ name: '&quot;Kesariya&quot;', artistNames: 'Unknown' }), '🎵 "Kesariya"');
  assert.equal(songText({ name: null, artistNames: null }), '🎵 A song');
});

test('the cover is the last https image', () => {
  const image = [
    { quality: '50x50', link: 'https://c.saavncdn.com/a-50x50.jpg' },
    { quality: '500x500', link: 'https://c.saavncdn.com/a-500x500.jpg' },
  ];
  assert.equal(songCover({ image }), 'https://c.saavncdn.com/a-500x500.jpg');
  assert.equal(songCover({ image: [{ link: 'http://insecure.test/a.jpg' }] }), null);
  assert.equal(songCover({ image: 'https://c.saavncdn.com/a.jpg' }), null);
  assert.equal(songCover({}), null);
});
