import type { Server, Socket } from 'socket.io';
import { getUserGroups, musicGroups, roomOf, type MusicGroup } from './state';

/*
 * Your rooms as your other devices see them: which room, what it's playing and on which device,
 * so the Rooms screen elsewhere can say "Listening on Chrome on Windows" and offer to move it.
 * Moving it is an ordinary join, which takes the room over (`claimRoomDevice`); this only tells.
 *
 *   room:mine  (command, acknowledged)  → { rooms: MyRoom[] }
 *   room:mine  (event, to all of a user's sockets)  { rooms: MyRoom[] }, whenever one of their
 *              rooms changes device, song or play state, or they join or leave one
 */

export interface PlayingDevice {
  /** e.g. "Galaxy M06", "Chrome on Windows". */
  name: string;
  mobile: boolean;
}

export interface MyRoom {
  groupId: string;
  name: string;
  song: Record<string, unknown> | null;
  playing: boolean;
  /** Null while no device of yours is connected to it (reconnecting, or after a restart). */
  device: PlayingDevice | null;
}

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

const myRoomOf = (io: Server, userId: string, group: MusicGroup): MyRoom => ({
  groupId: group.id,
  name: group.name,
  song: group.current?.song ?? null,
  playing: Boolean(group.current) && group.timeline.playing,
  device: deviceOf(playingSocket(io, userId, group.id)),
});

export const myRoomsOf = (io: Server, userId: string | number): MyRoom[] => {
  const key = String(userId);
  return [...getUserGroups(key)]
    .map((groupId) => musicGroups.get(groupId))
    .filter((group): group is MusicGroup => Boolean(group))
    .map((group) => myRoomOf(io, key, group));
};

/** Tells every device of this user where their rooms are now. */
export const tellMyRooms = (io: Server, userId: string | number): void => {
  io.to(String(userId)).emit('room:mine', { rooms: myRoomsOf(io, userId) });
};

/** After a change everyone in the room would see from elsewhere: the song, or play and pause. */
export const tellMembersRooms = (io: Server, group: MusicGroup): void => {
  for (const member of group.members) tellMyRooms(io, member.userId);
};

type Ack<T> = ((response: T) => void) | undefined;

export const setupDeviceHandlers = (io: Server, socket: Socket, userId: string | number): void => {
  socket.on('room:mine', (_data: unknown, ack: Ack<{ rooms: MyRoom[] }>) => {
    if (typeof ack === 'function') ack({ rooms: myRoomsOf(io, userId) });
  });
};
