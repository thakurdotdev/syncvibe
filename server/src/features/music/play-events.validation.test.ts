import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completionPercent, isSkip, parsePlayEvent } from './play-events.validation';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const valid = {
  eventId: '6a3f1b52-2f0e-4c8b-9d11-0a1b2c3d4e5f',
  sessionId: '7b4f1b52-2f0e-4c8b-9d11-0a1b2c3d4e5f',
  songId: 'aRZbUYD7',
  source: 'direct',
  startedAt: '2026-11-05T11:50:00Z',
  playedMs: 120_000,
  durationMs: 262_000,
  endReason: 'completed',
  platform: 'app',
};

describe('parsePlayEvent', () => {
  it('accepts a valid event and defaults the recommendation fields', () => {
    const event = parsePlayEvent(valid, NOW);
    assert.equal(event?.songId, 'aRZbUYD7');
    assert.equal(event?.seedSongId, null);
    assert.equal(event?.position, null);
  });

  it('keeps recommendation details', () => {
    const event = parsePlayEvent({ ...valid, seedSongId: 'seed', position: 3 }, NOW);
    assert.equal(event?.seedSongId, 'seed');
    assert.equal(event?.position, 3);
  });

  it('rejects anything it cannot trust', () => {
    const invalid: Array<Record<string, unknown>> = [
      { eventId: 'not-a-uuid' },
      { sessionId: 'not-a-uuid' },
      { songId: '' },
      { source: 'nope' },
      { endReason: 'nope' },
      { platform: 'nope' },
      { playedMs: -1 },
      { playedMs: '100' },
      { startedAt: 'never' },
      { startedAt: '2026-11-08T00:00:00Z' },
      { startedAt: '2026-01-01T00:00:00Z' },
    ];
    for (const change of invalid) {
      assert.equal(parsePlayEvent({ ...valid, ...change }, NOW), null, JSON.stringify(change));
    }
    assert.equal(parsePlayEvent(null, NOW), null);
    assert.equal(parsePlayEvent('event', NOW), null);
  });

  it('caps an impossible listening time', () => {
    assert.equal(parsePlayEvent({ ...valid, playedMs: 1e12 }, NOW)?.playedMs, 6 * 60 * 60 * 1000);
  });
});

describe('isSkip', () => {
  it('counts pressing next early', () => {
    assert.ok(isSkip({ endReason: 'next', playedMs: 5_000 }));
  });

  it('does not count later presses, song endings or picking another song', () => {
    assert.ok(!isSkip({ endReason: 'next', playedMs: 30_000 }));
    assert.ok(!isSkip({ endReason: 'completed', playedMs: 5_000 }));
    assert.ok(!isSkip({ endReason: 'selected', playedMs: 5_000 }));
  });
});

describe('completionPercent', () => {
  it('caps at 100 and handles an unknown duration', () => {
    assert.equal(completionPercent(131_000, 262_000), 50);
    assert.equal(completionPercent(500_000, 262_000), 100);
    assert.equal(completionPercent(1_000, null), 0);
  });
});
