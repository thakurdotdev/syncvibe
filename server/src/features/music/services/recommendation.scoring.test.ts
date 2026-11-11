import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dropKnownTitles,
  engagement,
  fuseRelated,
  pickFavourites,
  pickForDay,
  pickSeeds,
  type Listen,
  type Pick,
} from './recommendation.scoring';

const NOW = new Date('2026-11-11T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const listen = (overrides: Partial<Listen> = {}): Listen => ({
  songId: 'a',
  name: 'Song',
  artist: 'Artist',
  playedCount: 1,
  completionRate: 0,
  skipCount: 0,
  lastPlayedAt: NOW,
  ...overrides,
});

const pick = (songId: string, overrides: Partial<Pick<string>> = {}): Pick<string> => ({
  songId,
  name: songId,
  artist: `artist-${songId}`,
  score: 1,
  kind: 'new',
  song: songId,
  ...overrides,
});

describe('engagement', () => {
  it('rises with replays and full listens, falls with skips', () => {
    const once = engagement(listen());
    assert.ok(engagement(listen({ playedCount: 8 })) > once);
    assert.ok(engagement(listen({ completionRate: 95 })) > once);
    assert.ok(engagement(listen({ playedCount: 4, skipCount: 3 })) < once);
  });

  it('treats a missing completion rate as unknown, not as a skip', () => {
    assert.ok(
      engagement(listen({ completionRate: 0 })) > engagement(listen({ completionRate: 20 }))
    );
  });
});

describe('pickSeeds', () => {
  it('prefers recent listening over old listening', () => {
    const seeds = pickSeeds(
      [
        listen({ songId: 'old', artist: 'A', playedCount: 3, lastPlayedAt: daysAgo(120) }),
        listen({ songId: 'recent', artist: 'B', playedCount: 3, lastPlayedAt: daysAgo(1) }),
      ],
      NOW
    );
    assert.deepEqual(
      seeds.map((seed) => seed.songId),
      ['recent', 'old']
    );
    assert.equal(seeds[0]!.weight, 1);
    assert.ok(seeds[1]!.weight < 0.1);
  });

  it('leaves out songs that are always skipped and limits each artist', () => {
    const seeds = pickSeeds(
      [
        listen({ songId: 'skipped', artist: 'X', playedCount: 2, skipCount: 2 }),
        listen({ songId: 'a1', playedCount: 9 }),
        listen({ songId: 'a2', playedCount: 8 }),
        listen({ songId: 'a3', playedCount: 7 }),
        listen({ songId: 'b1', artist: 'Other' }),
      ],
      NOW
    );
    assert.deepEqual(
      seeds.map((seed) => seed.songId),
      ['a1', 'a2', 'b1']
    );
  });

  it('returns nothing for an empty history', () => {
    assert.deepEqual(pickSeeds([], NOW), []);
  });
});

describe('fuseRelated', () => {
  it('ranks a song related to several seeds above the top match of one', () => {
    const fused = fuseRelated(
      [
        { songId: 's1', weight: 1 },
        { songId: 's2', weight: 0.9 },
      ],
      new Map([
        ['s1', ['only-s1', 'x', 'shared']],
        ['s2', ['y', 'shared']],
      ]),
      new Set()
    );
    assert.equal(fused[0]!.songId, 'shared');
  });

  it('never returns a song the listener has played', () => {
    const fused = fuseRelated(
      [{ songId: 's1', weight: 1 }],
      new Map([['s1', ['heard', 'new']]]),
      new Set(['heard'])
    );
    assert.deepEqual(
      fused.map((item) => item.songId),
      ['new']
    );
  });
});

describe('pickFavourites', () => {
  it('keeps replayed songs that have been resting', () => {
    const favourites = pickFavourites(
      [
        listen({ songId: 'resting', playedCount: 6, lastPlayedAt: daysAgo(40) }),
        listen({ songId: 'in-rotation', playedCount: 6, lastPlayedAt: daysAgo(2) }),
        listen({ songId: 'played-once', lastPlayedAt: daysAgo(40) }),
      ],
      NOW
    );
    assert.deepEqual(
      favourites.map((item) => item.songId),
      ['resting']
    );
  });
});

describe('dropKnownTitles', () => {
  it('drops other versions of heard songs and repeats within the list', () => {
    const kept = dropKnownTitles(
      [
        { name: 'Kesariya (Lofi Flip)' },
        { name: 'Apna Bana Le' },
        { name: 'Apna Bana Le - Female Version' },
      ],
      ['Kesariya']
    );
    assert.deepEqual(kept, [{ name: 'Apna Bana Le' }]);
  });
});

describe('pickForDay', () => {
  const pool = Array.from({ length: 40 }, (_, i) => pick(`n${i}`, { score: 1 - i / 80 }));

  it('gives the same list all day and a different one the next day', () => {
    const today = pickForDay(pool, 12, '7:2026-11-11');
    assert.deepEqual(pickForDay(pool, 12, '7:2026-11-11'), today);
    assert.notDeepEqual(pickForDay(pool, 12, '7:2026-11-12'), today);
    assert.equal(today.length, 12);
  });

  it('shows strong songs more often than weak ones', () => {
    const uneven = [pick('strong', { score: 1 }), pick('weak', { score: 0.3 })];
    for (let day = 0; day < 30; day++) {
      assert.equal(pickForDay(uneven, 1, `7:${day}`)[0]!.songId, 'strong');
    }
  });

  it('limits each artist and mixes in a few favourites', () => {
    const mixed = [
      ...Array.from({ length: 10 }, (_, i) => pick(`same${i}`, { artist: 'One Artist' })),
      ...pool,
      ...Array.from({ length: 10 }, (_, i) => pick(`f${i}`, { kind: 'favourite' as const })),
    ];
    const list = pickForDay(mixed, 12, '7:2026-11-11');
    assert.equal(list.filter((item) => item.artist === 'One Artist').length, 2);
    assert.equal(list.filter((item) => item.kind === 'favourite').length, 3);
    assert.equal(list[0]!.kind, 'new');
  });

  it('fills with favourites when there are too few new songs', () => {
    const list = pickForDay(
      [pick('n'), ...Array.from({ length: 8 }, (_, i) => pick(`f${i}`, { kind: 'favourite' }))],
      6,
      'k'
    );
    assert.equal(list.length, 6);
    assert.equal(new Set(list.map((item) => item.songId)).size, 6);
  });
});
