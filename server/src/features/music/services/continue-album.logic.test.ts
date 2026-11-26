import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { albumsInProgress, restOfAlbum } from './continue-album.logic';

const NOW = new Date('2026-11-26T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('albumsInProgress', () => {
  it('are albums with at least two different songs played lately, latest first', () => {
    const plays = [
      { songId: 'a1', albumId: 'A', playedAt: daysAgo(3) },
      { songId: 'a2', albumId: 'A', playedAt: daysAgo(2) },
      { songId: 'b1', albumId: 'B', playedAt: daysAgo(1) },
      { songId: 'b1', albumId: 'B', playedAt: daysAgo(0.5) },
      { songId: 'c1', albumId: 'C', playedAt: daysAgo(30) },
      { songId: 'c2', albumId: 'C', playedAt: daysAgo(29) },
      { songId: 'd1', albumId: 'D', playedAt: daysAgo(6) },
      { songId: 'd2', albumId: 'D', playedAt: daysAgo(5) },
    ];
    // B: one song twice is a favourite, not an album. C: too long ago.
    assert.deepEqual(albumsInProgress(plays, NOW), ['A', 'D']);
  });

  it('are none when no album has been played through lately', () => {
    assert.deepEqual(albumsInProgress([], NOW), []);
  });
});

describe('restOfAlbum', () => {
  const tracks = ['t1', 't2', 't3', 't4', 't5', 't6'];

  it('is what comes after the furthest song played, minus what you heard', () => {
    assert.deepEqual(restOfAlbum(tracks, new Set(['t1', 't3', 't5'])), null, 'only t6 left');
    assert.deepEqual(restOfAlbum(tracks, new Set(['t1', 't2'])), ['t3', 't4', 't5', 't6']);
    assert.deepEqual(restOfAlbum(tracks, new Set(['t2', 't4'])), ['t5', 't6']);
  });

  it('is nothing for an album you never played from', () => {
    assert.equal(restOfAlbum(tracks, new Set(['x'])), null);
  });
});
