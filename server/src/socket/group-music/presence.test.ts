import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server, Socket } from 'socket.io';
import {
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
