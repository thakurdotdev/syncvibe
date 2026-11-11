import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  add,
  clear,
  commit,
  createSession,
  currentItem,
  deviceLost,
  ended,
  load,
  MAX_ITEMS,
  next,
  pause,
  play,
  positionNow,
  previous,
  remove,
  reorder,
  report,
  resume,
  setShuffle,
  transfer,
  type PlayerSession,
} from './session';

const T = 1_000_000;
const PHONE = { deviceId: 'phone-1', name: 'Phone', mobile: true };
const WEB = { deviceId: 'web-1', name: 'Chrome', mobile: false };
const song = (id: string, duration = 200) => ({ id, name: `Song ${id}`, duration });
const songs = (...ids: string[]) => ids.map((id) => song(id));
const ids = (session: PlayerSession) => session.items.map((item) => item.song.id);
const current = (session: PlayerSession) => currentItem(session)?.song.id;

const loaded = (...songIds: string[]) => {
  const session = createSession('1', T);
  load(session, songs(...songIds), {}, T);
  return session;
};

test('load plays from the chosen song and drops duplicates', () => {
  const session = createSession('1', T);
  const change = load(
    session,
    [...songs('a', 'b'), song('a'), { bad: true }],
    { startIndex: 1 },
    T
  );
  assert.deepEqual(change, { playback: true, queue: { type: 'whole' } });
  assert.deepEqual(ids(session), ['a', 'b']);
  assert.equal(current(session), 'b');
  assert.equal(session.timeline.playing, true);
});

test('load keeps the songs around the chosen one when the list is too long', () => {
  const many = Array.from({ length: 300 }, (_, i) => song(`s${i}`));
  const session = createSession('1', T);
  load(session, many, { startIndex: 250 }, T);
  assert.equal(session.items.length, MAX_ITEMS);
  assert.equal(current(session), 's250');
  assert.equal(session.items[0]!.song.id, 's100');
});

test('pause and play keep the position', () => {
  const session = loaded('a');
  pause(session, T + 5000);
  assert.equal(positionNow(session, T + 60000), 5000);
  play(session, T + 60000);
  assert.equal(positionNow(session, T + 61000), 6000);
});

test('next names the song it was meant for, so a double tap skips one', () => {
  const session = loaded('a', 'b', 'c');
  const first = currentItem(session)!.id;
  next(session, T, first);
  assert.deepEqual(next(session, T, first), {});
  assert.equal(current(session), 'b');
});

test('previous restarts the song past 3 seconds, otherwise goes back', () => {
  const session = loaded('a', 'b');
  next(session, T);
  previous(session, T + 5000);
  assert.equal(current(session), 'b');
  assert.equal(positionNow(session, T + 5000), 0);
  previous(session, T + 6000);
  assert.equal(current(session), 'a');
});

test('ended moves on, repeats, or stops at the end of the queue', () => {
  const session = loaded('a', 'b');
  const a = currentItem(session)!.id;
  ended(session, a, T + 200000);
  assert.equal(current(session), 'b');
  // A late report for a song that's no longer playing changes nothing.
  assert.deepEqual(ended(session, a, T + 200001), {});

  const b = currentItem(session)!.id;
  ended(session, b, T + 400000);
  assert.equal(current(session), 'b');
  assert.equal(session.timeline.playing, false);

  session.repeat = 'all';
  play(session, T);
  ended(session, b, T + 600000);
  assert.equal(current(session), 'a');

  session.repeat = 'one';
  ended(session, currentItem(session)!.id, T + 800000);
  assert.equal(current(session), 'a');
  assert.equal(positionNow(session, T + 800000), 0);
});

test('add skips songs already queued and can go straight after the current one', () => {
  const session = loaded('a', 'b');
  const result = add(session, songs('b', 'c'), { next: true }, T);
  assert.ok(typeof result !== 'string');
  assert.equal(result.added, 1);
  assert.deepEqual(ids(session), ['a', 'c', 'b']);
  assert.equal(result.change.queue?.type, 'add');
});

test('add to an empty session makes the first song current, paused', () => {
  const session = createSession('1', T);
  const result = add(session, songs('a'), {}, T);
  assert.ok(typeof result !== 'string');
  assert.equal(result.change.playback, true);
  assert.equal(current(session), 'a');
  assert.equal(session.timeline.playing, false);
});

test('a full queue drops played songs to make room, never upcoming ones', () => {
  const many = Array.from({ length: MAX_ITEMS }, (_, i) => song(`s${i}`));
  const session = createSession('1', T);
  load(session, many, { startIndex: 0 }, T);
  assert.equal(add(session, songs('x'), {}, T), 'queue-full');

  for (let i = 0; i < 5; i++) next(session, T);
  const result = add(session, songs('x'), {}, T);
  assert.ok(typeof result !== 'string');
  assert.equal(result.change.queue?.type, 'whole');
  assert.equal(session.items.length, MAX_ITEMS);
  assert.equal(current(session), 's5');
  assert.equal(session.items.at(-1)!.song.id, 'x');
});

test('remove and clear keep the song playing', () => {
  const session = loaded('a', 'b', 'c');
  const [a, b] = session.items;
  assert.deepEqual(remove(session, [a!.id, b!.id]), { queue: { type: 'remove', ids: [b!.id] } });
  clear(session);
  assert.deepEqual(ids(session), ['a']);
});

test('reorder needs exactly the same items', () => {
  const session = loaded('a', 'b', 'c');
  const [a, b, c] = session.items.map((item) => item.id);
  assert.equal(reorder(session, [a, b]), 'invalid');
  assert.equal(reorder(session, [a, a, b]), 'invalid');
  reorder(session, [c, a, b]);
  assert.deepEqual(ids(session), ['c', 'a', 'b']);
});

test('shuffle keeps the current song first and turning it off restores the order', () => {
  const session = loaded('a', 'b', 'c', 'd');
  next(session, T);
  setShuffle(session, true, () => 0);
  assert.equal(session.items[0]!.song.id, 'b');
  add(session, songs('e'), {}, T);
  setShuffle(session, false);
  assert.deepEqual(ids(session), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(current(session), 'b');
});

test('transfer carries on from the same position on the new device', () => {
  const session = loaded('a');
  transfer(session, PHONE, T);
  transfer(session, WEB, T + 30000);
  assert.equal(session.active?.deviceId, 'web-1');
  assert.equal(positionNow(session, T + 30000), 30000);
  assert.equal(session.timeline.playing, true);
});

test('transfer of a paused session plays only when asked to', () => {
  const session = loaded('a');
  pause(session, T + 1000);
  transfer(session, WEB, T + 2000);
  assert.equal(session.timeline.playing, false);
  transfer(session, PHONE, T + 3000, true);
  assert.equal(session.timeline.playing, true);
  assert.equal(positionNow(session, T + 3000), 1000);
});

test('only the active device reports, and only for the latest revision', () => {
  const session = loaded('a');
  transfer(session, PHONE, T);
  commit(session, { playback: true });
  const itemId = currentItem(session)!.id;
  const rev = session.revs.playback;

  assert.equal(
    report(session, WEB.deviceId, { rev, itemId, positionMs: 0, playing: false }, T),
    'not-active'
  );
  // Close enough to where the session thinks it is: nothing to tell anyone.
  assert.deepEqual(
    report(session, PHONE.deviceId, { rev, itemId, positionMs: 10300, playing: true }, T + 10000),
    {}
  );
  // Stalled: the phone is the clock.
  report(session, PHONE.deviceId, { rev, itemId, positionMs: 8000, playing: true }, T + 10000);
  assert.equal(positionNow(session, T + 10000), 8000);

  // Someone paused from the laptop; the phone's report from before it heard is ignored.
  pause(session, T + 11000);
  commit(session, { playback: true });
  assert.equal(
    report(session, PHONE.deviceId, { rev, itemId, positionMs: 9000, playing: true }, T + 11000),
    'stale'
  );
  assert.equal(session.timeline.playing, false);
});

test('a lost active device leaves the session paused where it was', () => {
  const session = loaded('a');
  transfer(session, PHONE, T);
  assert.deepEqual(deviceLost(session, WEB.deviceId, T), {});
  deviceLost(session, PHONE.deviceId, T + 45000);
  assert.equal(session.active, null);
  assert.equal(session.timeline.playing, false);
  assert.equal(positionNow(session, T + 90000), 45000);
});

test('a device coming back takes back what it played offline if nothing happened meanwhile', () => {
  const session = loaded('a', 'b');
  transfer(session, PHONE, T);
  commit(session, { playback: true });
  const rev = session.revs.playback;

  resume(session, PHONE, { rev, songId: 'b', positionMs: 30000, playing: true }, T + 250000);
  assert.equal(current(session), 'b');
  assert.equal(positionNow(session, T + 250000), 30000);
});

test('a device coming back follows the session if it changed meanwhile', () => {
  const session = loaded('a', 'b');
  transfer(session, PHONE, T);
  commit(session, { playback: true });
  const rev = session.revs.playback;
  transfer(session, WEB, T + 1000);
  commit(session, { playback: true });

  assert.deepEqual(
    resume(session, PHONE, { rev, songId: 'b', positionMs: 0, playing: true }, T + 2000),
    {}
  );
  assert.equal(session.active?.deviceId, 'web-1');
  assert.equal(current(session), 'a');
});

test("the playing device's own reports aren't jumps, but seeks and transfers are", () => {
  const session = loaded('a');
  transfer(session, PHONE, T);
  commit(session, { playback: true });
  const jumps = session.jumps;
  const itemId = currentItem(session)!.id;
  report(
    session,
    PHONE.deviceId,
    { rev: session.revs.playback, itemId, positionMs: 0, playing: true },
    T + 9000
  );
  assert.equal(session.jumps, jumps);
  transfer(session, WEB, T + 10000);
  assert.equal(session.jumps, jumps + 1);
});
