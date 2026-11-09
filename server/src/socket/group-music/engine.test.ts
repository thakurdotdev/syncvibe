import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server } from 'socket.io';
import { runCommand, type RoomCommand } from './commands';
import { effects } from './effects';
import { handleMemberGone } from './host';
import { createGroupState, legacyRoomOf, musicGroups, syncRoomOf } from './state';
import { leadFor, msUntilEnd, pausedAt, playFrom, positionAt } from './timeline';

const GROUP = 'g1';
const START = 1_000_000;

const song = (id: string, duration = 200) => ({ id, name: `Song ${id}`, duration });

const setup = (options: { pro?: boolean } = {}) => {
  const sent: { room: string; event: string; payload: any }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => sent.push({ room, event, payload }),
    }),
  } as unknown as Server;

  const group = createGroupState({
    id: GROUP,
    name: 'Room',
    createdBy: 1,
    userName: 'Host',
    planLimits: options.pro === false ? null : ({ realtimeSyncEnabled: true } as any),
  });
  group.settings.autoPlayRecommendations = false;
  group.members.push({ userId: 2, userName: 'Guest' });
  musicGroups.set(GROUP, group);

  const as = (userId: number) => group.members.find((m) => m.userId === userId)!;
  const cmd = (userId: number, command: Omit<RoomCommand, 'groupId'>) =>
    runCommand(io, group, as(userId), { groupId: GROUP, ...command });
  const events = (room: string, event: string) =>
    sent.filter((s) => s.room === room && s.event === event).map((s) => s.payload);

  return { io, group, cmd, sent, events };
};

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: START });
});
afterEach(() => {
  mock.timers.reset();
  musicGroups.clear();
  effects.recommend = async () => [];
});

test('the timeline gives the same position to anyone who knows the time', () => {
  const playing = playFrom(30_000, START, 400);
  assert.equal(positionAt(playing, START), 30_000, 'holds until the scheduled start');
  assert.equal(positionAt(playing, START + 400), 30_000);
  assert.equal(positionAt(playing, START + 5_400), 35_000);
  assert.equal(msUntilEnd(playing, 60_000, START), 30_400);

  const paused = pausedAt(42_000, START);
  assert.equal(positionAt(paused, START + 60_000), 42_000);
  assert.equal(msUntilEnd(paused, 60_000, START), null);
});

test('a start is scheduled further ahead for slower connections, within limits', () => {
  assert.equal(leadFor('resume', 40), 120);
  assert.equal(leadFor('resume', 200), 260);
  assert.equal(leadFor('resume', 5000), 500);
  assert.equal(leadFor('track', 100), 500);
  assert.equal(leadFor('track', 5000), 1500);
});

test('the first song added starts the room, and both protocols hear about it', async () => {
  const { group, cmd, events } = setup();
  assert.deepEqual(await cmd(2, { type: 'add', song: song('a') }), { ok: true, addedCount: 1 });

  assert.equal(group.current?.song.id, 'a');
  assert.equal(group.upcoming.length, 0);
  assert.equal(group.timeline.playing, true);
  assert.ok(group.timeline.anchorAt > START, 'starts slightly in the future');

  const [playback] = events(syncRoomOf(GROUP), 'room:playback');
  assert.equal(playback.kind, 'track');
  assert.equal(playback.item.song.id, 'a');
  assert.equal(playback.rev, group.revs.playback);

  const [legacy] = events(legacyRoomOf(GROUP), 'music-update');
  assert.equal(legacy.song.id, 'a');
  assert.equal(legacy.scheduledPlayTime, group.timeline.anchorAt);
  const [queue] = events(legacyRoomOf(GROUP), 'queue-updated');
  assert.equal(queue.currentQueueIndex, 0);
  assert.equal(queue.queue[0].song.id, 'a');
});

test('pause and resume keep the position on the server clock', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add', song: song('a') });
  const startedAt = group.timeline.anchorAt;

  mock.timers.tick(startedAt - START + 10_000);
  await cmd(2, { type: 'pause' });
  assert.equal(group.timeline.playing, false);
  assert.equal(group.timeline.positionMs, 10_000);

  mock.timers.tick(60_000);
  await cmd(2, { type: 'play' });
  assert.equal(group.timeline.playing, true);
  assert.equal(group.timeline.positionMs, 10_000);
  assert.ok(group.timeline.anchorAt > Date.now(), 'resume is lined up ahead of time');
});

test('the room moves to the next song by itself when one ends', async () => {
  const { group, cmd, events } = setup();
  await cmd(1, { type: 'add', song: song('a', 100) });
  await cmd(1, { type: 'add', song: song('b', 100) });
  assert.equal(group.current?.song.id, 'a');

  mock.timers.tick(110_000);
  await Promise.resolve();
  assert.equal(group.current?.song.id, 'b');
  assert.equal(group.upcoming.length, 0);

  mock.timers.tick(110_000);
  await Promise.resolve();
  assert.equal(group.current, null);
  assert.equal(group.timeline.playing, false);
  assert.equal(events(legacyRoomOf(GROUP), 'queue-ended').length, 1);
  assert.equal(events(syncRoomOf(GROUP), 'room:playback').at(-1).kind, 'stop');
});

test('several devices reporting the same ending skip only one song', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a', 100), song('b'), song('c')] });
  const first = group.current!.id;

  mock.timers.tick(99_000);
  await cmd(1, { type: 'ended', itemId: first });
  await cmd(2, { type: 'ended', itemId: first });
  assert.equal(group.current?.song.id, 'b');
  assert.equal(group.upcoming.length, 1);
});

test('an ending reported long before the end is not believed', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a', 200), song('b')] });
  mock.timers.tick(20_000);
  await cmd(2, { type: 'ended', itemId: group.current!.id });
  assert.equal(group.current?.song.id, 'a');
});

test('a skip that names a song already gone does nothing', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a'), song('b'), song('c')] });
  const first = group.current!.id;
  await cmd(1, { type: 'skip', itemId: first });
  await cmd(2, { type: 'skip', itemId: first });
  assert.equal(group.current?.song.id, 'b');
});

test('autoplay fills an empty queue before the room would stop', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add', song: song('a', 100) });
  group.settings.autoPlayRecommendations = true;
  let excluded: string[] = [];
  effects.recommend = async ({ excludeSongIds }) => {
    excluded = excludeSongIds;
    return [song('r1'), song('r2')];
  };

  await cmd(1, { type: 'skip' });
  assert.equal(group.current?.song.id, 'r1');
  assert.equal(group.current?.isAutoRecommended, true);
  assert.deepEqual(
    group.upcoming.map((i) => i.song.id),
    ['r2']
  );
  assert.ok(excluded.includes('a'));
});

test('recommendations that arrive after the room ran out start it again', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add', song: song('a', 100) });
  group.settings.autoPlayRecommendations = true;
  let deliver: (songs: Array<Record<string, unknown>>) => void = () => {};
  effects.recommend = () => new Promise((resolve) => (deliver = resolve));

  // A top-up is already on its way when the song is skipped, so the skip can't wait for one.
  await cmd(1, { type: 'set-autoplay', enabled: true });
  await cmd(1, { type: 'skip' });
  assert.equal(group.current, null);

  deliver([song('r1'), song('r2')]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(group.current?.song.id, 'r1');
  assert.equal(group.timeline.playing, true);
});

test('queue: play next, jump to a song, move by id, remove own only', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a'), song('b'), song('c')] });
  await cmd(2, { type: 'add-next', song: song('d') });
  const ids = () => group.upcoming.map((i) => i.song.id);
  assert.deepEqual(ids(), ['d', 'b', 'c']);

  assert.equal((await cmd(2, { type: 'add', song: song('b') })).ok, false, 'duplicate');

  const c = group.upcoming.find((i) => i.song.id === 'c')!;
  await cmd(2, { type: 'move', itemId: c.id, toIndex: 0 });
  assert.deepEqual(ids(), ['c', 'd', 'b']);

  const b = group.upcoming.find((i) => i.song.id === 'b')!;
  const denied = await cmd(2, { type: 'remove', itemId: b.id });
  assert.equal(denied.ok, false, "a guest can't remove the host's song");
  assert.equal((await cmd(1, { type: 'remove', itemId: b.id })).ok, true);

  const d = group.upcoming.find((i) => i.song.id === 'd')!;
  await cmd(2, { type: 'play-item', itemId: d.id });
  assert.equal(group.current?.song.id, 'd');
  assert.deepEqual(ids(), ['c'], 'songs before it stay queued');
});

test('playing a queued song now moves it rather than duplicating it', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a'), song('b'), song('c')] });
  await cmd(1, { type: 'play-now', song: song('c') });
  assert.equal(group.current?.song.id, 'c');
  assert.deepEqual(
    group.upcoming.map((i) => i.song.id),
    ['b']
  );
});

test('the free plan queue limit counts the song that is playing', async () => {
  const { group, cmd } = setup({ pro: false });
  const result = await cmd(1, {
    type: 'add-many',
    songs: ['a', 'b', 'c', 'd'].map((s) => song(s)),
  });
  assert.deepEqual(result, { ok: true, addedCount: 3 });
  assert.equal(group.upcoming.length, 2);
  const full = await cmd(1, { type: 'add', song: song('e') });
  assert.equal(full.ok === false && full.code, 'queue-full');
});

test('host-only mode: guests can add songs but not control playback', async () => {
  const { group, cmd } = setup();
  await cmd(1, { type: 'add', song: song('a') });
  assert.equal((await cmd(2, { type: 'set-control-mode', mode: 'host' })).ok, false);
  assert.equal((await cmd(1, { type: 'set-control-mode', mode: 'host' })).ok, true);

  for (const type of ['pause', 'skip', 'seek', 'shuffle', 'clear']) {
    const result = await cmd(2, { type, positionMs: 0 });
    assert.equal(result.ok === false && result.code, 'host-only', type);
  }
  assert.equal(group.timeline.playing, true);
  assert.equal((await cmd(2, { type: 'add', song: song('b') })).ok, true);
  assert.equal((await cmd(1, { type: 'pause' })).ok, true);
});

test('the host leaving hands the room to someone still connected', () => {
  const { io, group, events } = setup();
  group.members.push({ userId: 3, userName: 'Third' });
  group.members[1]!.connected = false;
  group.members = group.members.filter((m) => m.userId !== 1);
  handleMemberGone(io, group, 1);
  assert.equal(group.createdBy, 3);
  assert.equal(events(syncRoomOf(GROUP), 'room:meta').at(-1).hostId, 3);
});

test('an empty room pauses instead of playing on to no one', async () => {
  const { io, group, cmd } = setup();
  await cmd(1, { type: 'add-many', songs: [song('a', 100), song('b', 100)] });
  mock.timers.tick(30_000);
  group.members = [];
  handleMemberGone(io, group, 1);
  assert.equal(group.timeline.playing, false);
  mock.timers.tick(300_000);
  assert.equal(group.current?.song.id, 'a');
});

test('older versions are told about a resume at the moment it starts', async () => {
  const { group, cmd, events } = setup();
  await cmd(1, { type: 'add', song: song('a') });
  mock.timers.tick(5_000);
  await cmd(1, { type: 'pause' });
  assert.equal(events(legacyRoomOf(GROUP), 'playback-update').length, 1);

  await cmd(1, { type: 'play' });
  assert.equal(events(legacyRoomOf(GROUP), 'playback-update').length, 1, 'not yet');
  mock.timers.tick(group.timeline.anchorAt - Date.now());
  const resume = events(legacyRoomOf(GROUP), 'playback-update').at(-1);
  assert.equal(resume.isPlaying, true);
  assert.equal(resume.serverTime, group.timeline.anchorAt);
});
