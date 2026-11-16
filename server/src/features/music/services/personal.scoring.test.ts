import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeBlend,
  hourBandOf,
  interleave,
  leadArtists,
  mixGroups,
  weekStartOf,
  type MoodListen,
} from './personal.scoring';

const NOW = new Date('2026-11-16T12:00:00Z');

const listen = (songId: string, overrides: Partial<MoodListen> = {}): MoodListen => ({
  songId,
  name: `Song ${songId}`,
  artist: 'Artist',
  playedCount: 3,
  completionRate: 90,
  skipCount: 0,
  lastPlayedAt: NOW,
  language: 'hindi',
  mood: null,
  ...overrides,
});
const many = (prefix: string, count: number, overrides: Partial<MoodListen>) =>
  Array.from({ length: count }, (_, i) => listen(`${prefix}${i}`, overrides));

describe('mixGroups', () => {
  it('keeps each language and mood apart, strongest first', () => {
    const groups = mixGroups(
      [
        ...many('r', 8, { mood: 'romantic', playedCount: 6 }),
        ...many('p', 6, { mood: 'party', language: 'punjabi' }),
      ],
      NOW
    );
    assert.deepEqual(
      groups.map((group) => group.key),
      ['hindi:romantic', 'punjabi:party']
    );
  });

  it('leaves out a side of taste with too few songs to fill a mix', () => {
    const groups = mixGroups(
      [
        ...many('r', 8, { mood: 'romantic' }),
        ...many('s', 6, { mood: 'sad' }),
        ...many('d', 2, { mood: 'devotional' }),
      ],
      NOW
    );
    assert.ok(!groups.some((group) => group.mood === 'devotional'));
  });

  it('falls back to one mix per language when moods are unknown', () => {
    const groups = mixGroups([...many('h', 6, {}), ...many('e', 5, { language: 'english' })], NOW);
    assert.deepEqual(
      groups.map((group) => group.key),
      ['hindi:any', 'english:any']
    );
    assert.equal(groups[0]!.mood, null);
  });
});

describe('leadArtists', () => {
  it('names the artists played most', () => {
    const names = leadArtists([
      listen('a', { artist: 'Arijit Singh', playedCount: 9 }),
      listen('b', { artist: 'KK', playedCount: 1 }),
      listen('c', { artist: 'Shreya Ghoshal', playedCount: 5 }),
    ]);
    assert.deepEqual(names, ['Arijit Singh', 'Shreya Ghoshal']);
  });
});

describe('interleave', () => {
  it('puts a familiar song after every few new ones and keeps the rest at the end', () => {
    assert.deepEqual(interleave(['n1', 'n2', 'n3'], ['f1', 'f2', 'f3'], 2, 10), [
      'n1',
      'n2',
      'f1',
      'n3',
      'f2',
      'f3',
    ]);
  });
});

describe('hourBandOf', () => {
  it('reads past midnight as late night', () => {
    assert.equal(hourBandOf(23), 'night');
    assert.equal(hourBandOf(1), 'night');
    assert.equal(hourBandOf(15), 'afternoon');
    assert.equal(hourBandOf(7), 'morning');
  });
});

describe('composeBlend', () => {
  const ids = (...list: string[]) => list.map((songId) => ({ songId }));

  it('leads with shared songs, then alternates sides without repeats', () => {
    const blend = composeBlend(ids('both'), ids('m1', 'both', 'm2'), ids('t1', 't2'), 10);
    assert.deepEqual(
      blend.map((item) => `${item.side}:${item.songId}`),
      ['both:both', 'you:m1', 'them:t1', 'them:t2', 'you:m2']
    );
  });

  it('stops at the limit', () => {
    assert.equal(composeBlend([], ids('a', 'b', 'c'), ids('d', 'e'), 3).length, 3);
  });
});

describe('weekStartOf', () => {
  it('starts at local midnight six days before today, in India', () => {
    // 01:30 on 17 November in India.
    const start = weekStartOf(Date.parse('2026-11-16T20:00:00Z'), -330);
    assert.equal(start.toISOString(), '2026-11-10T18:30:00.000Z');
  });
});
