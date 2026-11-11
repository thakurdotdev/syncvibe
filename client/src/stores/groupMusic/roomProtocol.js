import { addClockSample, clockRtt } from './roomClock';

/** Sent when joining, so the server speaks the current sync protocol to this device. */
export const ROOM_PROTOCOL = 2;

const COMMAND_TIMEOUT_MS = 8000;
const PING_TIMEOUT_MS = 4000;

/**
 * Asks the room to do something. Always resolves, with `{ ok }` and an `error` to show if it
 * didn't happen. Nothing is sent while offline: by the time it went out it would be out of date.
 */
export const sendRoomCommand = (socket, groupId, type, payload = {}) =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) {
      resolve({ ok: false, code: 'offline', error: 'You are offline. Reconnecting…' });
      return;
    }
    socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emit('room:cmd', { groupId, type, ...payload }, (err, result) => {
        if (err || !result) {
          resolve({ ok: false, code: 'timeout', error: 'The room did not respond. Try again.' });
        } else resolve(result);
      });
  });

/**
 * One ping: refines the clock, and brings back the room's revisions (or `error` if this device
 * has lost its place in the room). Resolves to null if there was no answer.
 */
export const pingRoom = (socket, groupId) =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) return resolve(null);
    const sentAt = Date.now();
    socket
      .timeout(PING_TIMEOUT_MS)
      .emit('room:ping', { groupId, rtt: clockRtt() ?? undefined }, (err, reply) => {
        if (err || !reply) return resolve(null);
        if (typeof reply.serverTime === 'number') {
          addClockSample(sentAt, reply.serverTime, Date.now());
        }
        resolve(reply);
      });
  });

/** The whole room in one message, for when this device has missed something. */
export const fetchRoomSnapshot = (socket, groupId) =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) return resolve(null);
    socket.timeout(COMMAND_TIMEOUT_MS).emit('room:sync', { groupId }, (err, snapshot) => {
      resolve(err || !snapshot ? null : snapshot);
    });
  });

/** The queue as the screens show it: the current song first, then what's coming up. */
export const queueViewOf = (currentItem, upcoming) => ({
  queue: currentItem ? [currentItem, ...upcoming] : upcoming,
  currentQueueIndex: currentItem ? 0 : -1,
});

/**
 * Your rooms and the device each is playing on, so this one can offer to take one over.
 * Resolves to null if there was no answer.
 */
export const fetchMyRooms = (socket) =>
  new Promise((resolve) => {
    if (!socket?.connected) return resolve(null);
    socket.timeout(COMMAND_TIMEOUT_MS).emit('room:mine', {}, (err, reply) => {
      resolve(err || !Array.isArray(reply?.rooms) ? null : reply.rooms);
    });
  });

/** Stops offering a room you left, on all your devices. */
export const forgetMyRoom = (socket, groupId) => {
  if (socket?.connected && groupId) socket.emit('room:forget', { groupId });
};
