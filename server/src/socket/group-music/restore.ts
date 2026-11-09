import type { Server } from 'socket.io';
import { resumeRoom } from './engine';
import { handleUserDisconnect } from './presence';
import { forgetRoom, loadRooms } from './room-store';
import { musicGroups, trackUserGroup } from './state';

/** Don't hold up starting the server for a Redis that isn't answering. */
const RESTORE_TIMEOUT_MS = 5000;

/**
 * Brings back the rooms that were open when the server last stopped. Call before accepting
 * connections: a device that reconnects first would be told its room is gone, and leave it.
 *
 * Nobody is connected yet, so everyone shows as reconnecting and gets the usual grace period to
 * come back before counting as having left. Returns how many rooms were restored.
 */
export const restoreRooms = async (io: Server): Promise<number> => {
  const rooms = await Promise.race([
    loadRooms(),
    new Promise<[]>((resolve) => setTimeout(() => resolve([]), RESTORE_TIMEOUT_MS).unref()),
  ]);

  const users = new Set<string>();
  let restored = 0;
  for (const room of rooms) {
    if (musicGroups.has(room.id)) continue;
    if (room.members.length === 0) {
      forgetRoom(room.id);
      continue;
    }
    musicGroups.set(room.id, room);
    for (const member of room.members) {
      member.connected = false;
      trackUserGroup(member.userId, room.id);
      users.add(String(member.userId));
    }
    resumeRoom(io, room);
    restored++;
  }
  users.forEach((userId) => handleUserDisconnect(io, userId));
  return restored;
};
