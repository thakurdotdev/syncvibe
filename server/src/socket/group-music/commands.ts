import type { Server, Socket } from 'socket.io';
import { revsOf, snapshotOf } from './broadcast';
import {
  advance,
  clearQueue,
  enqueue,
  moveItem,
  noteRtt,
  playItem,
  playNow,
  removeItem,
  reportEnded,
  seekTo,
  setAutoplay,
  setControlMode,
  setPlaying,
  shuffle,
} from './engine';
import { transferHost } from './host';
import { answerRejoin } from './rejoin-requests';
import { removeFromRoom, setCoHost, setMuted, voteSkip, type ModerationError } from './moderation';
import { QUEUE_ERROR_TEXT, type QueueError } from './queue';
import {
  canManage,
  findMember,
  isHost,
  musicGroups,
  roomOf,
  type GroupMember,
  type MusicGroup,
} from './state';

/*
 * What a device may ask of a room. Every request is answered, so the device knows whether it
 * happened; and who is asking comes from the connection, never from what the request claims.
 */

export type CommandError =
  | QueueError
  | ModerationError
  | 'gone'
  | 'not-in-room'
  | 'host-only'
  | 'rate-limited'
  | 'unknown-command';

export type CommandResult =
  | { ok: true; addedCount?: number }
  | { ok: false; code: CommandError; error: string };

const ERROR_TEXT: Record<CommandError, string> = {
  ...QUEUE_ERROR_TEXT,
  gone: 'This room is no longer active',
  'not-in-room': 'You are not in this room',
  'host-only': 'Only the hosts can do that',
  'not-allowed': "You can't do that to this person",
  'rate-limited': 'Too many requests. Give it a moment.',
  'unknown-command': 'Unknown request',
};

const OK: CommandResult = { ok: true };
export const fail = (code: CommandError): CommandResult => ({
  ok: false,
  code,
  error: ERROR_TEXT[code],
});
const done = (error: QueueError | ModerationError | null): CommandResult =>
  error ? fail(error) : OK;

export interface RoomCommand {
  groupId: string;
  type: string;
  song?: Record<string, unknown>;
  songs?: Array<Record<string, unknown>>;
  itemId?: string;
  positionMs?: number;
  toIndex?: number;
  enabled?: boolean;
  mode?: string;
  userId?: string | number;
}

/** The room and the caller's place in it, or why they can't act on it. */
export const resolveMember = (
  socket: Socket,
  userId: string | number | undefined,
  groupId: unknown
): { group: MusicGroup; member: GroupMember } | { code: 'gone' | 'not-in-room' } => {
  const group = typeof groupId === 'string' ? musicGroups.get(groupId) : undefined;
  if (!group) return { code: 'gone' };
  const member = findMember(group, userId);
  if (!member || !socket.rooms.has(roomOf(group.id))) return { code: 'not-in-room' };
  return { group, member };
};

const mayControl = (group: MusicGroup, member: GroupMember) =>
  group.settings.controlMode !== 'host' || canManage(group, member.userId);

const isSong = (song: unknown): song is Record<string, unknown> =>
  typeof song === 'object' && song !== null && !Array.isArray(song);

/** Carries out one request on a room. Shared by the current protocol and the older events. */
export const runCommand = async (
  io: Server,
  group: MusicGroup,
  member: GroupMember,
  command: RoomCommand
): Promise<CommandResult> => {
  const host = isHost(group, member.userId);
  const manager = canManage(group, member.userId);
  const control = mayControl(group, member);

  switch (command.type) {
    // A device's own player finishing isn't a decision, so it needs no permission.
    case 'ended':
      await reportEnded(io, group, String(command.itemId ?? ''));
      return OK;

    case 'play':
    case 'pause':
      if (!control) return fail('host-only');
      setPlaying(io, group, command.type === 'play', member);
      return OK;

    case 'seek':
      if (!control) return fail('host-only');
      return seekTo(io, group, Number(command.positionMs), member) ? OK : fail('invalid');

    case 'skip':
      if (!control) return fail('host-only');
      // Naming the song makes a double tap, or two people skipping at once, skip only one.
      await advance(io, group, { reason: 'skip', expectedItemId: command.itemId, by: member });
      return OK;

    case 'play-now':
      if (!control) return fail('host-only');
      return isSong(command.song)
        ? done(playNow(io, group, command.song, member))
        : fail('invalid');

    case 'play-item':
      if (!control) return fail('host-only');
      return done(playItem(io, group, String(command.itemId ?? '')));

    case 'add':
    case 'add-next':
    case 'add-many': {
      if (!group.settings.allowAnyoneToAdd && !manager) return fail('host-only');
      const songs = command.type === 'add-many' ? command.songs : [command.song];
      if (!Array.isArray(songs) || !songs.every(isSong)) return fail('invalid');
      const { addedCount, error } = enqueue(
        io,
        group,
        songs.slice(0, group.settings.maxQueueSize),
        member,
        {
          next: command.type === 'add-next',
          action:
            command.type === 'add'
              ? 'add'
              : command.type === 'add-next'
                ? 'play-next'
                : 'playlist-added',
        }
      );
      return addedCount > 0 ? { ok: true, addedCount } : fail(error ?? 'invalid');
    }

    case 'remove':
      return done(removeItem(io, group, String(command.itemId ?? ''), member));

    case 'move':
      if (!control) return fail('host-only');
      return done(
        moveItem(io, group, String(command.itemId ?? ''), Number(command.toIndex), member)
      );

    case 'shuffle':
      if (!control) return fail('host-only');
      shuffle(io, group, member);
      return OK;

    case 'clear':
      if (!control) return fail('host-only');
      clearQueue(io, group, member);
      return OK;

    case 'set-autoplay':
      if (!control) return fail('host-only');
      setAutoplay(io, group, command.enabled);
      return OK;

    case 'set-control-mode':
      if (!host) return fail('host-only');
      return setControlMode(io, group, command.mode === 'host' ? 'host' : 'everyone')
        ? OK
        : fail('invalid');

    case 'transfer-host':
      if (!host) return fail('host-only');
      return command.userId != null &&
        transferHost(io, group, command.userId, { keepOldAsCoHost: true })
        ? OK
        : fail('not-found');

    case 'set-cohost':
      if (!host) return fail('host-only');
      return done(setCoHost(io, group, member, command.userId, command.enabled !== false));

    case 'mute':
      if (!manager) return fail('host-only');
      return done(setMuted(io, group, member, command.userId, command.enabled !== false));

    case 'remove-member':
      if (!manager) return fail('host-only');
      return done(removeFromRoom(io, group, member, command.userId));

    // `enabled`: let them back in, or say no.
    case 'answer-rejoin':
      if (!manager) return fail('host-only');
      return done(answerRejoin(io, group, member, command.userId, command.enabled !== false));

    // Open to everyone: it's how people without control still get a say.
    case 'vote-skip':
      return done(await voteSkip(io, group, member, String(command.itemId ?? '')));

    default:
      return fail('unknown-command');
  }
};

const RATE_WINDOW_MS = 10000;
const RATE_MAX = 40;

/** Stops a stuck or hostile device flooding a room. Dragging a seek bar stays well under it. */
export const allowCommand = (socket: Socket): boolean => {
  const now = Date.now();
  const recent: number[] = (socket.data.roomCommands ??= []);
  while (recent.length > 0 && now - recent[0]! > RATE_WINDOW_MS) recent.shift();
  if (recent.length >= RATE_MAX) return false;
  recent.push(now);
  return true;
};

type Ack<T> = ((response: T) => void) | undefined;
const reply = <T>(ack: Ack<T>, response: T) => {
  if (typeof ack === 'function') ack(response);
};

export const setupCommandHandlers = (io: Server, socket: Socket, userId: string | number): void => {
  /**
   * Clock sync and a health check in one. The device works out the server's clock from when it
   * sent this and when the reply came back, and compares revisions to spot anything it missed.
   */
  socket.on(
    'room:ping',
    (data: { groupId?: string; rtt?: number }, ack: Ack<Record<string, unknown>>) => {
      const found = resolveMember(socket, userId, data?.groupId);
      if ('code' in found) return reply(ack, { serverTime: Date.now(), error: found.code });
      noteRtt(found.group, socket.id, data?.rtt);
      reply(ack, { serverTime: Date.now(), revs: revsOf(found.group) });
    }
  );

  socket.on('room:sync', (data: { groupId?: string }, ack: Ack<Record<string, unknown>>) => {
    const found = resolveMember(socket, userId, data?.groupId);
    reply(ack, 'code' in found ? { error: found.code } : snapshotOf(found.group));
  });

  socket.on('room:cmd', async (command: RoomCommand, ack: Ack<CommandResult>) => {
    try {
      const found = resolveMember(socket, userId, command?.groupId);
      if ('code' in found) return reply(ack, fail(found.code));
      if (!allowCommand(socket)) return reply(ack, fail('rate-limited'));
      reply(ack, await runCommand(io, found.group, found.member, command));
    } catch (err) {
      console.error('[GroupMusic] Command failed:', err);
      reply(ack, fail('invalid'));
    }
  });
};
