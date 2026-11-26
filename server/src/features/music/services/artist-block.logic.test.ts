import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { artistIdsOf, withoutBlockedArtists } from './artist-block.logic';

const song = (id: string, artists: Array<{ id: string; role?: string }>) => ({
  id,
  artist_map: { artists },
});

describe('artistIdsOf', () => {
  it('counts singers and composers, not lyricists or actors', () => {
    assert.deepEqual(
      artistIdsOf(
        song('s', [
          { id: '1', role: 'singer' },
          { id: '2', role: 'music' },
          { id: '3', role: 'lyricist' },
          { id: '4', role: 'starring' },
        ])
      ),
      ['1', '2']
    );
  });
});

describe('withoutBlockedArtists', () => {
  it('drops songs by a blocked artist and keeps the order', () => {
    const songs = [
      song('a', [{ id: '1', role: 'singer' }]),
      song('b', [{ id: '9', role: 'singer' }]),
      song('c', [
        { id: '2', role: 'singer' },
        { id: '9', role: 'lyricist' },
      ]),
    ];
    assert.deepEqual(
      withoutBlockedArtists(songs, new Set(['9'])).map((s) => s.id),
      ['a', 'c']
    );
    assert.equal(withoutBlockedArtists(songs, new Set()), songs);
  });
});
