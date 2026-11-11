import type { Socket } from 'socket.io-client';
import { addClockSample, clockRtt } from './roomClock';
import type { RoomPlayback } from './roomSync';
import type { Song } from '@/types/song';
import type { GroupMember, QueueItem, RejoinRequest, SkipVotes } from './types';

/** Sent when joining, so the server speaks the current sync protocol to this device. */
export const ROOM_PROTOCOL = 2;

const COMMAND_TIMEOUT_MS = 8000;
const PING_TIMEOUT_MS = 4000;

export type CommandResult =
  | { ok: true; addedCount?: number }
  | { ok: false; code: string; error: string };

export interface RoomRevs {
  playback: number;
  queue: number;
  meta: number;
}

export interface RoomQueuePart {
  rev: number;
  upcoming: QueueItem[];
}

export interface RoomMetaPart {
  rev: number;
  hostId: number | string;
  coHosts?: string[];
  mutedIds?: string[];
  skipVotes?: SkipVotes | null;
  rejoinRequests?: RejoinRequest[];
  settings: {
    maxQueueSize: number;
    allowAnyoneToAdd: boolean;
    autoPlayRecommendations?: boolean;
    controlMode?: 'everyone' | 'host';
  };
  maxMembers?: number;
  features?: { realtimeChat?: boolean; realtimeSync?: boolean };
}

export interface RoomSnapshot {
  groupId: string;
  serverTime: number;
  playback: RoomPlayback;
  queue: RoomQueuePart;
  meta: RoomMetaPart;
  members: GroupMember[];
  error?: string;
}

export interface PingReply {
  serverTime: number;
  revs?: RoomRevs;
  error?: 'gone' | 'not-in-room';
}

type RoomSocket = Socket | null | undefined;

/**
 * Asks the room to do something. Always resolves, with `ok` and an `error` to show if it didn't
 * happen. Nothing is sent while offline: by the time it went out it would be out of date.
 */
export const sendRoomCommand = (
  socket: RoomSocket,
  groupId: string | undefined,
  type: string,
  payload: Record<string, unknown> = {}
): Promise<CommandResult> =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) {
      resolve({ ok: false, code: 'offline', error: 'You are offline. Reconnecting…' });
      return;
    }
    socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emit('room:cmd', { groupId, type, ...payload }, (err: unknown, result?: CommandResult) => {
        if (err || !result) {
          resolve({ ok: false, code: 'timeout', error: 'The room did not respond. Try again.' });
        } else resolve(result);
      });
  });

/**
 * One ping: refines the clock, and brings back the room's revisions (or `error` if this device
 * has lost its place in the room). Resolves to null if there was no answer.
 */
export const pingRoom = (socket: RoomSocket, groupId: string): Promise<PingReply | null> =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) return resolve(null);
    const sentAt = Date.now();
    socket
      .timeout(PING_TIMEOUT_MS)
      .emit(
        'room:ping',
        { groupId, rtt: clockRtt() ?? undefined },
        (err: unknown, reply?: PingReply) => {
          if (err || !reply) return resolve(null);
          if (typeof reply.serverTime === 'number') {
            addClockSample(sentAt, reply.serverTime, Date.now());
          }
          resolve(reply);
        }
      );
  });

/** The whole room in one message, for when this device has missed something. */
export const fetchRoomSnapshot = (
  socket: RoomSocket,
  groupId: string
): Promise<RoomSnapshot | null> =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) return resolve(null);
    socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emit('room:sync', { groupId }, (err: unknown, snapshot?: RoomSnapshot) => {
        resolve(err || !snapshot ? null : snapshot);
      });
  });

/** The queue as the screens show it: the current song first, then what's coming up. */
export const queueViewOf = (currentItem: QueueItem | null, upcoming: QueueItem[]) => ({
  queue: currentItem ? [currentItem, ...upcoming] : upcoming,
  currentQueueIndex: currentItem ? 0 : -1,
});

/** A room you're in, as your other devices see it (server `socket/group-music/devices.ts`). */
export interface JoinedRoom {
  status: 'member';
  groupId: string;
  name: string;
  song: Song | null;
  playing: boolean;
  /** Null while no device of yours is connected to the room. */
  device: { name: string; mobile: boolean } | null;
}

/** A room you were in lately and can go back to. */
export interface LeftRoom {
  status: 'left';
  groupId: string;
  name: string;
  leftAt: number;
  full: boolean;
}

/** Not asked yet, waiting, declined (you can ask again later), or declined too often to ask. */
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

/**
 * Your rooms and the device each is playing on, so this one can offer to take one over.
 * Resolves to null if there was no answer.
 */
export const fetchMyRooms = (socket: RoomSocket): Promise<MyRoom[] | null> =>
  new Promise((resolve) => {
    if (!socket?.connected) return resolve(null);
    socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emit('room:mine', {}, (err: unknown, reply?: { rooms?: MyRoom[] }) => {
        resolve(err || !Array.isArray(reply?.rooms) ? null : reply.rooms);
      });
  });

/** Stops offering a room you left, on all your devices. */
export const forgetMyRoom = (socket: RoomSocket, groupId: string): void => {
  if (socket?.connected && groupId) socket.emit('room:forget', { groupId });
};

/** Asks the hosts of a room that removed you to let you back in. */
export const askToRejoin = (
  socket: RoomSocket,
  groupId: string
): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => {
    if (!socket?.connected || !groupId) {
      resolve({ ok: false, error: 'You are offline. Reconnecting…' });
      return;
    }
    socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emit(
        'room:ask-rejoin',
        { groupId },
        (err: unknown, result?: { ok: boolean; error?: string }) => {
          resolve(err || !result ? { ok: false, error: 'No answer. Try again.' } : result);
        }
      );
  });
