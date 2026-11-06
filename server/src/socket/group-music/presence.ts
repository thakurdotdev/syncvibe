import type { Server, Socket } from 'socket.io';
import { getUserGroups, musicGroups, removeGroup, TIME_TO_REJOIN, untrackUserGroup } from './state';

/** How long a room outlives its last member, so one person's dropped signal doesn't end it. */
export const EMPTY_ROOM_TTL = 120000;

const roomOf = (groupId: string) => `music-group-${groupId}`;
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

const expireIfEmpty = (groupId: string) => {
  const group = musicGroups.get(groupId);
  setTimeout(() => {
    if (group && musicGroups.get(groupId) === group && group.members.length === 0) {
      removeGroup(groupId);
    }
  }, EMPTY_ROOM_TTL);
};

const removeMember = (io: Server, groupId: string, userId: string | number) => {
  const group = musicGroups.get(groupId);
  if (!group) return;
  group.members = group.members.filter((m) => String(m.userId) !== String(userId));
  untrackUserGroup(userId, groupId);
  io.to(roomOf(groupId)).emit('member-left', { userId });
  if (group.members.length === 0) expireIfEmpty(groupId);
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
