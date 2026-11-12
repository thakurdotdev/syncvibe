import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blockedTitlesOf, personalizePlayNext, type PastListen } from './play-next.personal';

const NOW = new Date('2026-11-12T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const heard = (days: number, overrides: Partial<PastListen> = {}): PastListen => ({
  lastPlayedAt: daysAgo(days),
  playedCount: 1,
  skipCount: 0,
  ...overrides,
});
const songs = (...ids: string[]) => ids.map((songId) => ({ songId, name: `Song ${songId}` }));

const run = (
  candidates: Array<{ songId: string; name: string }>,
  history: Record<string, PastListen> = {},
  options: { disliked?: string[]; blockedTitles?: string[]; limit?: number } = {}
) =>
  personalizePlayNext({
    candidates,
    history: new Map(Object.entries(history)),
    dislikedIds: new Set(options.disliked ?? []),
    blockedTitles: new Set(options.blockedTitles ?? []),
    now: NOW,
    limit: options.limit ?? 20,
  });

describe('personalizePlayNext', () => {
  it('keeps the shared order for a listener with no history', () => {
    assert.deepEqual(run(songs('a', 'b', 'c')), ['a', 'b', 'c']);
  });

  it('puts unheard songs first and one familiar song in every fifth slot', () => {
    const result = run(songs('k1', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'), { k1: heard(30) });
    assert.deepEqual(result, ['n1', 'n2', 'n3', 'n4', 'k1', 'n5', 'n6']);
  });

  it('never returns disliked songs or other versions of them', () => {
    const result = run(
      [
        { songId: 'a', name: 'Tum Hi Ho' },
        { songId: 'b', name: 'Tum Hi Ho (Lofi)' },
        { songId: 'c', name: 'Other Song' },
      ],
      {},
      { disliked: ['a'], blockedTitles: [...blockedTitlesOf(['Tum Hi Ho'])] }
    );
    assert.deepEqual(result, ['c']);
  });

  it('drops songs the listener mostly skips', () => {
    assert.deepEqual(run(songs('a', 'b'), { a: heard(10, { skipCount: 2, playedCount: 2 }) }), [
      'b',
    ]);
  });

  it('only uses songs played in the last few days when nothing else is left', () => {
    const history = { r1: heard(0.1), r2: heard(1), old: heard(20) };
    assert.deepEqual(run(songs('r1', 'r2', 'old', 'n1'), history), ['n1', 'old', 'r2', 'r1']);
    assert.deepEqual(run(songs('r1', 'n1', 'n2'), history, { limit: 2 }), ['n1', 'n2']);
  });

  it('fills with familiar songs once the unheard ones run out', () => {
    const history = { k1: heard(10), k2: heard(20) };
    assert.deepEqual(run(songs('k1', 'k2', 'n1'), history), ['n1', 'k1', 'k2']);
  });
});

describe('blockedTitlesOf', () => {
  it('skips one-word titles, which many unrelated songs share', () => {
    assert.deepEqual(
      [...blockedTitlesOf(['Baarish', 'Tum Hi Ho - From "Aashiqui 2"'])],
      ['tum hi ho']
    );
  });
});
