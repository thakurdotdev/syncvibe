import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Server } from 'socket.io';
import { myRoomsOf, tellMembersRooms } from './devices';
import { claimRoomDevice } from './presence';
import { createGroupState, musicGroups, trackUserGroup, userGroups } from './state';
import { playFrom } from './timeline';

const GROUP = 'g1';
const ROOM = `music-group-${GROUP}`;
const PHONE = { name: 'Galaxy M06', mobile: true };
const LAPTOP = { name: 'Chrome on Windows', mobile: false };

const setup = () => {
  const rooms = new Map<string, Set<string>>();
  const sockets = new Map<string, any>();
  const told: { room: string; event: string; payload: any }[] = [];
  const io = {
    sockets: { adapter: { rooms }, sockets },
    to: (room: string) => ({
      emit: (event: string, payload: any) => told.push({ room, event, payload }),
    }),
  } as unknown as Server;

  const join = (name: string, id: string) => {
    if (!rooms.has(name)) rooms.set(name, new Set());
    rooms.get(name)!.add(id);
  };
  /** A signed-in device of `userId`, in the room or not. */
  const device = (id: string, userId: string, info: typeof PHONE, inRoom: boolean) => {
    const socket = {
      id,
      data: { identity: { device: info }, deviceId: `${id}-id` },
      leave: (room: string) => rooms.get(room)?.delete(id),
      emit: () => {},
    };
    sockets.set(id, socket);
    join(userId, id);
    if (inRoom) join(ROOM, id);
    return socket;
  };

  const group = createGroupState({ id: GROUP, name: 'Friday', createdBy: 'a', userName: 'A' });
  musicGroups.set(GROUP, group);
  trackUserGroup('a', GROUP);
  return { io, group, device, told };
};

afterEach(() => {
  musicGroups.clear();
  userGroups.clear();
});

test('your other device sees which device the room is playing on', () => {
  const { io, group, device } = setup();
  device('phone', 'a', PHONE, true);
  device('web', 'a', LAPTOP, false);
  group.current = {
    id: 'q1',
    song: { id: 's1', name: 'Song' },
    addedBy: { userId: 'a', userName: 'A' },
    addedAt: 0,
    status: 'playing',
  };
  group.timeline = playFrom(0, Date.now(), 0);

  assert.deepEqual(myRoomsOf(io, 'a'), [
    {
      groupId: GROUP,
      name: 'Friday',
      song: { id: 's1', name: 'Song' },
      playing: true,
      device: PHONE,
    },
  ]);
});

test('after moving the room, it shows as playing on the device you moved it to', () => {
  const { io, device } = setup();
  device('phone', 'a', PHONE, true);
  const web = device('web', 'a', LAPTOP, false);

  claimRoomDevice(io, web as any, GROUP, 'a', 'web-id', true);
  io.sockets.adapter.rooms.get(ROOM)!.add('web');

  assert.deepEqual(myRoomsOf(io, 'a')[0]?.device, LAPTOP);
});

test('a room no device of yours is connected to has no device', () => {
  const { io, device } = setup();
  device('web', 'a', LAPTOP, false);
  assert.equal(myRoomsOf(io, 'a')[0]?.device, null);
});

test("someone else's device in the room is not yours", () => {
  const { io, group, device } = setup();
  group.members.push({ userId: 'b', userName: 'B' });
  trackUserGroup('b', GROUP);
  device('friend', 'b', PHONE, true);
  assert.equal(myRoomsOf(io, 'a')[0]?.device, null);
  assert.deepEqual(myRoomsOf(io, 'b')[0]?.device, PHONE);
});

test('every member is told, each on their own devices', () => {
  const { io, group, told } = setup();
  group.members.push({ userId: 'b', userName: 'B' });
  trackUserGroup('b', GROUP);
  tellMembersRooms(io, group);
  assert.deepEqual(
    told.map((t) => [t.room, t.event]),
    [
      ['a', 'room:mine'],
      ['b', 'room:mine'],
    ]
  );
});
