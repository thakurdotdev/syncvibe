import type { Server, Socket } from 'socket.io';
import { tellFormerMembers, tellMyRooms } from './devices';
import { noteDeparture } from './former';
import { handleMemberGone } from './host';
import { touchRoom } from './room-store';
import {
  allRoomsOf,
  findMember,
  getUserGroups,
  legacyRoomOf,
  musicGroups,
  removeGroup,
  roomOf,
  syncRoomOf,
  TIME_TO_REJOIN,
  untrackUserGroup,
  type MusicGroup,
} from './state';

/** How long a room outlives its last member, so one person's dropped signal doesn't end it. */
export const EMPTY_ROOM_TTL = 120000;

const removalTimers = new Map<string, NodeJS.Timeout>();
const timerKey = (groupId: string, userId: string | number) => `${groupId}:${userId}`;

/** Every socket of a user is in a room named after them, so this covers all their devices. */
const hasLiveConnection = (io: Server, userId: string | number) =>
  (io.sockets.adapter.rooms.get(String(userId))?.size ?? 0) > 0;

/** Asks the sockets themselves, rather than a record that a reconnect can leave out of date. */
export const isUserInGroupRoom = (io: Server, userId: string | number, groupId: string) => {
  const own = io.sockets.adapter.rooms.get(String(userId));
  const room = io.sockets.adapter.rooms.get(roomOf(groupId));
  if (!own || !room) return false;
  for (const socketId of own) {
    if (room.has(socketId)) return true;
  }
  return false;
};

/**
 * One person, one device per room: two would play over each other. Returns whether this socket may
 * join. Joining on purpose takes the room over from any other device; an automatic rejoin doesn't,
 * or a device coming back online would snatch the room from the one you moved to. Your own device
 * coming back always gets in, replacing its old connection, which may not have timed out yet.
 */
export const claimRoomDevice = (
  io: Server,
  socket: Socket,
  groupId: string,
  userId: string | number,
  deviceId: string | undefined,
  takeOver: boolean
): boolean => {
  socket.data.deviceId = deviceId;
  // App and web versions from before this don't say which device they are, so aren't guarded.
  if (!deviceId && !takeOver) return true;

  const room = io.sockets.adapter.rooms.get(roomOf(groupId));
  const others = [...(io.sockets.adapter.rooms.get(String(userId)) ?? [])]
    .filter((id) => id !== socket.id && room?.has(id))
    .map((id) => io.sockets.sockets.get(id))
    .filter((other): other is Socket => Boolean(other));

  if (!takeOver && others.some((other) => other.data.deviceId !== deviceId)) return false;

  for (const other of others) {
    for (const room of allRoomsOf(groupId)) other.leave(room);
    other.emit('device-replaced', { groupId });
  }
  return true;
};

/**
 * Puts a connection in the room, and with the devices that speak its protocol so each kind is
 * only sent the events it understands.
 */
export const enterRoom = (socket: Socket, groupId: string, protocol: unknown): void => {
  const current = Number(protocol) >= 2;
  socket.leave(current ? legacyRoomOf(groupId) : syncRoomOf(groupId));
  socket.join([roomOf(groupId), current ? syncRoomOf(groupId) : legacyRoomOf(groupId)]);
};

/**
 * Forgets a socket that has gone. A phone changing network usually connects again before its old
 * connection times out, so this must not forget the newer one that has taken over since.
 * Returns whether the user is still connected on something else.
 */
export const releaseSocket = (
  io: Server,
  userSockets: Map<string, Socket>,
  userId: string,
  socket: Socket
): boolean => {
  const stillConnected = hasLiveConnection(io, userId);
  if (userSockets.get(userId) === socket && !stillConnected) userSockets.delete(userId);
  return stillConnected;
};

const setConnected = (io: Server, groupId: string, userId: string | number, connected: boolean) => {
  const member = musicGroups.get(groupId)?.members.find((m) => String(m.userId) === String(userId));
  if (!member || (member.connected !== false) === connected) return;
  member.connected = connected;
  io.to(roomOf(groupId)).emit('member-presence', { userId, connected });
  tellMyRooms(io, userId);
};

/** Call whenever a socket joins a room: it cancels any removal in progress for that user. */
export const markMemberPresent = (io: Server, groupId: string, userId: string | number) => {
  cancelRemoval(groupId, userId);
  setConnected(io, groupId, userId, true);
};

export const cancelRemoval = (groupId: string, userId: string | number) => {
  const key = timerKey(groupId, userId);
  const timer = removalTimers.get(key);
  if (timer) clearTimeout(timer);
  removalTimers.delete(key);
};

const expireIfEmpty = (io: Server, groupId: string) => {
  const group = musicGroups.get(groupId);
  setTimeout(() => {
    if (group && musicGroups.get(groupId) === group && group.members.length === 0) {
      removeGroup(groupId);
      tellFormerMembers(io, group);
    }
  }, EMPTY_ROOM_TTL);
};

/**
 * Takes someone out of a room for good. Being removed by a host also takes every device of theirs
 * out of it and tells them; `left-group` is what older versions already act on.
 */
export const dropMember = (
  io: Server,
  group: MusicGroup,
  userId: string | number,
  options: { removed?: boolean } = {}
) => {
  const groupId = group.id;
  const member = findMember(group, userId);
  const wasCoHost = group.coHosts.includes(String(userId));
  if (member) noteDeparture(group, member, { wasCoHost: options.removed && wasCoHost });
  group.members = group.members.filter((m) => String(m.userId) !== String(userId));
  untrackUserGroup(userId, groupId);
  cancelRemoval(groupId, userId);
  if (options.removed) {
    io.to(String(userId)).emit('left-group', { groupId, removed: true });
    io.in(String(userId)).socketsLeave(allRoomsOf(groupId));
  }
  io.to(roomOf(groupId)).emit('member-left', { userId });
  tellMyRooms(io, userId);
  handleMemberGone(io, group, userId);
  touchRoom(group, 'core');
  if (group.members.length === 0) expireIfEmpty(io, groupId);
};

const removeMember = (io: Server, groupId: string, userId: string | number) => {
  const group = musicGroups.get(groupId);
  if (group) dropMember(io, group, userId);
};

/**
 * A socket has gone. The user shows as reconnecting straight away, and only leaves if no
 * connection of theirs is back in the room when the grace period ends.
 */
export const handleUserDisconnect = (io: Server, userId: string | number): void => {
  for (const groupId of getUserGroups(userId)) {
    if (isUserInGroupRoom(io, userId, groupId)) continue;

    setConnected(io, groupId, userId, false);
    cancelRemoval(groupId, userId);
    removalTimers.set(
      timerKey(groupId, userId),
      setTimeout(() => {
        removalTimers.delete(timerKey(groupId, userId));
        if (isUserInGroupRoom(io, userId, groupId)) markMemberPresent(io, groupId, userId);
        else removeMember(io, groupId, userId);
      }, TIME_TO_REJOIN)
    );
  }
};
