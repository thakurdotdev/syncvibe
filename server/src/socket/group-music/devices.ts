import type { Server, Socket } from 'socket.io';
import { forgetFormer, formerOf } from './former';
import { MAX_DECLINES } from './rejoin-requests';
import { touchRoom } from './room-store';
import {
  findMember,
  getUserGroups,
  musicGroups,
  roomOf,
  type FormerMember,
  type MusicGroup,
} from './state';

/*
 * Your rooms as your other devices see them, so the Rooms screen can offer the way back in:
 *  - rooms you're in: what's playing and on which device ("Playing on Chrome on Windows"), to move
 *    it here. Moving it is an ordinary join, which takes the room over (`claimRoomDevice`).
 *  - rooms you left lately (see `former.ts`), to rejoin; or, if a host removed you, to ask to be
 *    let back in (see `rejoin-requests.ts`).
 *
 *   room:mine    (command, acknowledged)  → { rooms: MyRoom[] }
 *   room:mine    (event, to all of a user's sockets)  { rooms: MyRoom[] }, whenever one of their
 *                rooms changes device, song or play state, or they join, leave or are let back in
 *   room:forget  { groupId } (acknowledged)  → { ok }: stop offering a room you left
 */

export interface PlayingDevice {
  /** e.g. "Galaxy M06", "Chrome on Windows". */
  name: string;
  mobile: boolean;
}

/** A room you're in. */
export interface JoinedRoom {
  status: 'member';
  groupId: string;
  name: string;
  song: Record<string, unknown> | null;
  playing: boolean;
  /** Null while no device of yours is connected to it (reconnecting, or after a restart). */
  device: PlayingDevice | null;
}

/** A room you were in lately and can go back to. */
export interface LeftRoom {
  status: 'left';
  groupId: string;
  name: string;
  leftAt: number;
  /** Rejoining would be refused until someone leaves. */
  full: boolean;
}

/**
 * Where asking a host to let you back in stands: not asked yet, waiting, declined (you can ask
 * again after a while; asking too soon is refused), or declined too often to ask again.
 */
export type RequestState = 'none' | 'pending' | 'declined' | 'blocked';

/** A room a host removed you from lately. You can ask to be let back in. */
export interface RemovedRoom {
  status: 'removed';
  groupId: string;
  name: string;
  leftAt: number;
  request: RequestState;
}

export type FormerRoom = LeftRoom | RemovedRoom;
export type MyRoom = JoinedRoom | FormerRoom;

const UNKNOWN_DEVICE: PlayingDevice = { name: 'Another device', mobile: false };

const deviceOf = (socket: Socket | undefined): PlayingDevice | null => {
  if (!socket) return null;
  const device = socket.data.identity?.device as PlayingDevice | undefined;
  return device ?? UNKNOWN_DEVICE;
};

/** The one socket of this user that is in the room. One device per room, so at most one. */
const playingSocket = (io: Server, userId: string, groupId: string): Socket | undefined => {
  const own = io.sockets.adapter.rooms.get(userId);
  const room = io.sockets.adapter.rooms.get(roomOf(groupId));
  if (!own || !room) return undefined;
  for (const socketId of own) {
    if (room.has(socketId)) return io.sockets.sockets.get(socketId);
  }
  return undefined;
};

const joinedRoomOf = (io: Server, userId: string, group: MusicGroup): JoinedRoom => ({
  status: 'member',
  groupId: group.id,
  name: group.name,
  song: group.current?.song ?? null,
  playing: Boolean(group.current) && group.timeline.playing,
  device: deviceOf(playingSocket(io, userId, group.id)),
});

const requestStateOf = ({ request }: FormerMember): RequestState => {
  if (!request) return 'none';
  if (request.pending) return 'pending';
  return request.declines >= MAX_DECLINES ? 'blocked' : 'declined';
};

const removedRoomOf = (group: MusicGroup, record: FormerMember): RemovedRoom => ({
  status: 'removed',
  groupId: group.id,
  name: group.name,
  leftAt: record.leftAt,
  request: requestStateOf(record),
});

const formerRoomOf = (group: MusicGroup, record: FormerMember): FormerRoom => {
  if (group.removedIds.includes(record.userId)) return removedRoomOf(group, record);
  return {
    status: 'left',
    groupId: group.id,
    name: group.name,
    leftAt: record.leftAt,
    full: group.members.length >= group.maxMembers,
  };
};

const joinedRooms = (io: Server, userId: string): JoinedRoom[] =>
  [...getUserGroups(userId)]
    .map((groupId) => musicGroups.get(groupId))
    .filter((group): group is MusicGroup => Boolean(group))
    .map((group) => joinedRoomOf(io, userId, group));

/** Every room has a few people in it at most, so looking through them all is cheap. */
const formerRooms = (userId: string): FormerRoom[] => {
  const now = Date.now();
  const rooms: FormerRoom[] = [];
  for (const group of musicGroups.values()) {
    const record = formerOf(group, userId, now);
    if (!record || findMember(group, userId)) continue;
    rooms.push(formerRoomOf(group, record));
  }
  return rooms.sort((a, b) => b.leftAt - a.leftAt);
};

export const myRoomsOf = (io: Server, userId: string | number): MyRoom[] => {
  const key = String(userId);
  return [...joinedRooms(io, key), ...formerRooms(key)];
};

/** Tells every device of this user where their rooms are now. */
export const tellMyRooms = (io: Server, userId: string | number): void => {
  io.to(String(userId)).emit('room:mine', { rooms: myRoomsOf(io, userId) });
};

/** After a change everyone in the room would see from elsewhere: the song, or play and pause. */
export const tellMembersRooms = (io: Server, group: MusicGroup): void => {
  for (const member of group.members) tellMyRooms(io, member.userId);
};

/** The room has ended: whoever could have rejoined it can't any more. */
export const tellFormerMembers = (io: Server, group: MusicGroup): void => {
  for (const userId of Object.keys(group.formerMembers)) tellMyRooms(io, userId);
};

type Ack<T> = ((response: T) => void) | undefined;

export const setupDeviceHandlers = (io: Server, socket: Socket, userId: string | number): void => {
  socket.on('room:mine', (_data: unknown, ack: Ack<{ rooms: MyRoom[] }>) => {
    if (typeof ack === 'function') ack({ rooms: myRoomsOf(io, userId) });
  });

  socket.on('room:forget', (data: { groupId?: string }, ack: Ack<{ ok: boolean }>) => {
    const group = typeof data?.groupId === 'string' ? musicGroups.get(data.groupId) : undefined;
    if (group && forgetFormer(group, userId)) {
      touchRoom(group, 'core');
      tellMyRooms(io, userId);
    }
    if (typeof ack === 'function') ack({ ok: true });
  });
};
