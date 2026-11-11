import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server } from 'socket.io';
import { deviceGone, deviceHello, LOST_GRACE_MS, resetHub, runCommand } from './hub';
import { sessionStore } from './store';

const START = 1_000_000;
const USER = '7';
const PHONE = { deviceId: 'phone-1', name: 'Phone', mobile: true };
const WEB = { deviceId: 'web-1', name: 'Chrome', mobile: false };
const song = (id: string) => ({ id, name: `Song ${id}`, duration: 200 });

const realStore = { ...sessionStore };

const setup = () => {
  const sent: { room: string; event: string; payload: any }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => sent.push({ room, event, payload }),
    }),
  } as unknown as Server;
  const events = (event: string) => sent.filter((s) => s.event === event).map((s) => s.payload);
  const last = (event: string) => events(event).at(-1);
  return { io, sent, events, last };
};

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: START });
  sessionStore.touch = () => {};
  sessionStore.load = async () => null;
  sessionStore.flush = async () => {};
});
afterEach(() => {
  resetHub();
  mock.timers.reset();
  Object.assign(sessionStore, realStore);
});

test('a song started on a remote plays on the device already playing', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });

  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a'), song('b')] });
  assert.equal(last('player:playback').active.deviceId, 'phone-1');

  await runCommand(io, USER, WEB, { type: 'load', songs: [song('c')] });
  assert.equal(last('player:playback').active.deviceId, 'phone-1');
  assert.equal(last('player:playback').song.id, 'c');

  await runCommand(io, USER, WEB, { type: 'play', here: true });
  assert.equal(last('player:playback').active.deviceId, 'web-1');
});

test('the queue goes out whole, then as edits on top of the last revision', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  await runCommand(io, USER, WEB, { type: 'load', songs: [song('a')] });
  const whole = last('player:queue');
  assert.equal(whole.items.length, 1);

  const result = await runCommand(io, USER, WEB, { type: 'add', songs: [song('b')] });
  assert.deepEqual(result, { ok: true, added: 1 });
  const edit = last('player:queue-edit');
  assert.equal(edit.rev, whole.rev + 1);
  assert.equal(edit.edit.type, 'add');
});

test('autoplay songs are taken only from the device playing, for the song playing', async () => {
  const { io } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a')] });
  const snapshot = await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  const itemId = snapshot.playback.itemId!;

  const fromRemote = await runCommand(io, USER, WEB, {
    type: 'add',
    autoplay: true,
    basedOn: itemId,
    songs: [song('r1')],
  });
  assert.deepEqual(fromRemote, { ok: true, ignored: true });

  const stale = await runCommand(io, USER, PHONE, {
    type: 'add',
    autoplay: true,
    basedOn: 'an-old-item',
    songs: [song('r1')],
  });
  assert.deepEqual(stale, { ok: true, ignored: true });

  const fresh = await runCommand(io, USER, PHONE, {
    type: 'add',
    autoplay: true,
    basedOn: itemId,
    songs: [song('r1')],
  });
  assert.deepEqual(fresh, { ok: true, added: 1 });
});

test('the playing device gets a grace period, then the session pauses with nobody playing', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a')] });

  deviceGone(io, USER, PHONE.deviceId, 's-phone');
  assert.equal(last('player:playback').activeOnline, false);
  assert.equal(last('player:playback').timeline.playing, true);

  mock.timers.tick(LOST_GRACE_MS);
  const playback = last('player:playback');
  assert.equal(playback.active, null);
  assert.equal(playback.timeline.playing, false);
  assert.equal(playback.timeline.positionMs, LOST_GRACE_MS);
});

test('coming back within the grace period keeps the device playing', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a')] });
  deviceGone(io, USER, PHONE.deviceId, 's-phone');
  mock.timers.tick(5000);
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone-2' });
  mock.timers.tick(LOST_GRACE_MS);
  assert.equal(last('player:playback').active.deviceId, 'phone-1');
  assert.equal(last('player:playback').timeline.playing, true);
});

test("an old socket closing doesn't take away the device's new connection", async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-old' });
  await deviceHello(io, USER, { device: PHONE, socketId: 's-new' });
  deviceGone(io, USER, PHONE.deviceId, 's-old');
  assert.deepEqual(
    last('player:devices').devices.map((d: { deviceId: string }) => d.deviceId),
    ['phone-1']
  );
});

test('starting while the playing device is offline moves playback to the one asking', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a')] });
  await runCommand(io, USER, WEB, { type: 'pause' });
  deviceGone(io, USER, PHONE.deviceId, 's-phone');

  await runCommand(io, USER, WEB, { type: 'play' });
  assert.equal(last('player:playback').active.deviceId, 'web-1');
  assert.equal(last('player:playback').timeline.playing, true);
});

test('transfer needs the device to be connected', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  await runCommand(io, USER, WEB, { type: 'load', songs: [song('a')] });
  const result = await runCommand(io, USER, WEB, { type: 'transfer', deviceId: 'phone-1' });
  assert.equal(result.ok, false);

  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await runCommand(io, USER, WEB, { type: 'transfer', deviceId: 'phone-1' });
  assert.equal(last('player:playback').active.deviceId, 'phone-1');
});

test('a failed play-item does not move playback', async () => {
  const { io, last } = setup();
  await deviceHello(io, USER, { device: PHONE, socketId: 's-phone' });
  await deviceHello(io, USER, { device: WEB, socketId: 's-web' });
  await runCommand(io, USER, PHONE, { type: 'load', songs: [song('a')] });
  const result = await runCommand(io, USER, WEB, { type: 'play-item', itemId: 'nope', here: true });
  assert.equal(result.ok, false);
  assert.equal(last('player:playback').active.deviceId, 'phone-1');
});
