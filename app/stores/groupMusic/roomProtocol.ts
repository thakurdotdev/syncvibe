import type { Socket } from 'socket.io-client';
import { addClockSample, clockRtt } from './roomClock';
import type { RoomPlayback } from './roomSync';
import type { GroupMember, QueueItem, SkipVotes } from './types';

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
