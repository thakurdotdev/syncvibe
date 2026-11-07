import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server, Socket } from 'socket.io';
import {
  claimRoomDevice,
  EMPTY_ROOM_TTL,
  handleUserDisconnect,
  isUserInGroupRoom,
  markMemberPresent,
  releaseSocket,
} from './presence';
import { musicGroups, TIME_TO_REJOIN, trackUserGroup, userGroups } from './state';

const GROUP = 'g1';
const ROOM = `music-group-${GROUP}`;

const setup = (members: string[]) => {
  const rooms = new Map<string, Set<string>>();
  const events: { event: string; payload: any }[] = [];
  const io = {
    sockets: { adapter: { rooms } },
    to: () => ({ emit: (event: string, payload: any) => events.push({ event, payload }) }),
  } as unknown as Server;
  const connect = (socketId: string, userId: string) => {
    for (const name of [userId, ROOM]) {
      if (!rooms.has(name)) rooms.set(name, new Set());
      rooms.get(name)!.add(socketId);
    }
  };
  const drop = (socketId: string) => {
    for (const [name, set] of rooms) {
      set.delete(socketId);
      if (set.size === 0) rooms.delete(name);
    }
  };
  musicGroups.set(GROUP, {
    id: GROUP,
    members: members.map((userId) => ({ userId, userName: userId })),
  } as any);
  members.forEach((userId) => trackUserGroup(userId, GROUP));
  const memberIds = () => musicGroups.get(GROUP)?.members.map((m) => String(m.userId));
  return { io, connect, drop, events, memberIds };
};

beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
afterEach(() => {
  mock.timers.reset();
  musicGroups.clear();
  userGroups.clear();
});

test('a new connection survives its old one timing out afterwards', () => {
  const { io, connect, drop, events, memberIds } = setup(['a', 'b']);
  const oldSocket = { id: 'old' } as Socket;
  const newSocket = { id: 'new' } as Socket;
  const userSockets = new Map<string, Socket>([['a', newSocket]]);
  connect('old', 'a');
  connect('new', 'a');
  connect('b1', 'b');

  drop('old');
  assert.equal(releaseSocket(io, userSockets, 'a', oldSocket), true);
  handleUserDisconnect(io, 'a');
  mock.timers.tick(TIME_TO_REJOIN + 1);

  assert.equal(userSockets.get('a'), newSocket);
  assert.deepEqual(memberIds(), ['a', 'b']);
  assert.equal(events.length, 0, 'nobody should be told anything changed');
});

test('a user with a phone and a browser stays when one of them closes', () => {
  const { io, connect, drop, memberIds } = setup(['a']);
  connect('phone', 'a');
  connect('web', 'a');
  drop('web');
  handleUserDisconnect(io, 'a');
  mock.timers.tick(TIME_TO_REJOIN + 1);
  assert.deepEqual(memberIds(), ['a']);
  assert.equal(isUserInGroupRoom(io, 'a', GROUP), true);
});

test('dropping shows as reconnecting first, then leaves after the grace period', () => {
  const { io, connect, drop, events, memberIds } = setup(['a', 'b']);
  connect('a1', 'a');
  connect('b1', 'b');
  drop('a1');
  handleUserDisconnect(io, 'a');

  assert.deepEqual(events[0], {
    event: 'member-presence',
    payload: { userId: 'a', connected: false },
  });
  assert.deepEqual(memberIds(), ['a', 'b']);

  mock.timers.tick(TIME_TO_REJOIN + 1);
  assert.deepEqual(memberIds(), ['b']);
  assert.deepEqual(events.at(-1), { event: 'member-left', payload: { userId: 'a' } });
  assert.equal(userGroups.get('a')?.has(GROUP) ?? false, false);
});

test('coming back within the grace period cancels leaving', () => {
  const { io, connect, drop, events, memberIds } = setup(['a', 'b']);
  connect('a1', 'a');
  connect('b1', 'b');
  drop('a1');
  handleUserDisconnect(io, 'a');

  connect('a2', 'a');
  markMemberPresent(io, GROUP, 'a');
  mock.timers.tick(TIME_TO_REJOIN + 1);

  assert.deepEqual(memberIds(), ['a', 'b']);
  assert.deepEqual(events.at(-1), {
    event: 'member-presence',
    payload: { userId: 'a', connected: true },
  });
  assert.ok(!events.some((e) => e.event === 'member-left'));
});

test('connected on the socket but not back in the room still counts as gone', () => {
  const { io, connect, drop, memberIds } = setup(['a', 'b']);
  connect('a1', 'a');
  connect('b1', 'b');
  drop('a1');
  handleUserDisconnect(io, 'a');
  // Reconnected without rejoining: an older app build does this.
  io.sockets.adapter.rooms.set('a', new Set(['a2']));
  mock.timers.tick(TIME_TO_REJOIN + 1);
  assert.deepEqual(memberIds(), ['b']);
});

test('a room survives a short gap after its last member drops, then expires', () => {
  const { io, connect, drop } = setup(['a']);
  connect('a1', 'a');
  drop('a1');
  handleUserDisconnect(io, 'a');
  mock.timers.tick(TIME_TO_REJOIN + 1);
  assert.ok(musicGroups.has(GROUP));
  mock.timers.tick(EMPTY_ROOM_TTL + 1);
  assert.ok(!musicGroups.has(GROUP));
});

test('an expiring room is kept if someone came back to it', () => {
  const { io, connect, drop } = setup(['a']);
  connect('a1', 'a');
  drop('a1');
  handleUserDisconnect(io, 'a');
  mock.timers.tick(TIME_TO_REJOIN + 1);
  musicGroups.get(GROUP)!.members.push({ userId: 'a', userName: 'a' });
  mock.timers.tick(EMPTY_ROOM_TTL + 1);
  assert.ok(musicGroups.has(GROUP));
});

const devices = () => {
  const rooms = new Map<string, Set<string>>();
  const sockets = new Map<string, any>();
  const io = { sockets: { adapter: { rooms }, sockets } } as unknown as Server;
  const device = (id: string, userId: string, deviceId?: string) => {
    const socket = {
      id,
      data: { deviceId },
      told: [] as string[],
      leave: (room: string) => rooms.get(room)?.delete(id),
      emit: (event: string) => socket.told.push(event),
    };
    sockets.set(id, socket);
    for (const name of [userId, ROOM]) {
      if (!rooms.has(name)) rooms.set(name, new Set());
      rooms.get(name)!.add(id);
    }
    return socket;
  };
  const incoming = (id: string, userId: string) => {
    const socket = device(id, userId);
    rooms.get(ROOM)!.delete(id);
    return socket as unknown as Socket;
  };
  return { io, device, incoming, rooms };
};

test('joining on a second device takes the room over from the first', () => {
  const { io, device, incoming, rooms } = devices();
  const phone = device('phone', 'a', 'phone-id');
  assert.equal(claimRoomDevice(io, incoming('web', 'a'), GROUP, 'a', 'web-id', true), true);
  assert.equal(rooms.get(ROOM)!.has('phone'), false);
  assert.deepEqual(phone.told, ['device-replaced']);
});

test('a device coming back online cannot snatch the room from the one you moved to', () => {
  const { io, device, incoming, rooms } = devices();
  const web = device('web', 'a', 'web-id');
  assert.equal(claimRoomDevice(io, incoming('phone2', 'a'), GROUP, 'a', 'phone-id', false), false);
  assert.equal(rooms.get(ROOM)!.has('web'), true);
  assert.deepEqual(web.told, []);
});

test('the same phone reconnecting replaces its own dead connection', () => {
  const { io, device, incoming, rooms } = devices();
  device('old', 'a', 'phone-id');
  assert.equal(claimRoomDevice(io, incoming('new', 'a'), GROUP, 'a', 'phone-id', false), true);
  assert.equal(rooms.get(ROOM)!.has('old'), false);
});

test("someone else's device in the room is never affected", () => {
  const { io, device, incoming, rooms } = devices();
  const friend = device('friend', 'b', 'friend-id');
  assert.equal(claimRoomDevice(io, incoming('mine', 'a'), GROUP, 'a', 'my-id', true), true);
  assert.equal(rooms.get(ROOM)!.has('friend'), true);
  assert.deepEqual(friend.told, []);
});

test('an older app that sends no device id can still rejoin', () => {
  const { io, device, incoming, rooms } = devices();
  device('other', 'a', 'other-id');
  assert.equal(claimRoomDevice(io, incoming('old-app', 'a'), GROUP, 'a', undefined, false), true);
  assert.equal(rooms.get(ROOM)!.has('other'), true);
});
