import type { Server, Socket } from 'socket.io';
import { tellMyRooms } from './devices';
import { formerOf } from './former';
import { metaChanged } from './host';
import type { ModerationError } from './moderation';
import {
  canManage,
  emitActivityMessage,
  isHost,
  musicGroups,
  type GroupMember,
  type MusicGroup,
} from './state';

/*
 * Asking to be let back into a room a host removed you from. The hosts see waiting requests in the
 * room's meta (`rejoinRequests`) and answer with the `answer-rejoin` command; letting someone in
 * lifts the removal, so their devices offer an ordinary Rejoin. Co-hosts can answer for listeners;
 * only the host can for someone removed while a co-host.
 *
 *   room:ask-rejoin      { groupId } (acknowledged)  → { ok } or { ok: false, code, error }
 *   room:rejoin-answer   (event, to the asker)  { groupId, name, accepted }
 */

/** Between one request and the next, so hosts aren't pestered. */
export const ASK_COOLDOWN_MS = 10 * 60 * 1000;
/** Declined this often, a person can't ask that room again. */
export const MAX_DECLINES = 2;

export type AskError = 'gone' | 'not-removed' | 'blocked' | 'too-soon' | 'no-hosts';

export const ASK_ERROR_TEXT: Record<AskError, string> = {
  gone: 'This room is no longer active',
  'not-removed': 'You can rejoin this room without asking',
  blocked: "A host has said no, so you can't ask again",
  'too-soon': 'Wait a few minutes before asking again',
  'no-hosts': 'No host is online right now. Try again later.',
};

const isOnline = (member: GroupMember) => member.connected !== false;

/** Someone who could answer is in the room right now. */
const canBeAnswered = (group: MusicGroup, hostOnly: boolean): boolean =>
  group.members.some(
    (member) =>
      isOnline(member) &&
      (hostOnly ? isHost(group, member.userId) : canManage(group, member.userId))
  );

export const askToRejoin = (
  io: Server,
  group: MusicGroup,
  userId: string | number,
  now = Date.now()
): AskError | null => {
  const record = formerOf(group, userId, now);
  if (!record || !group.removedIds.includes(record.userId)) return 'not-removed';

  const previous = record.request;
  if (previous?.pending) return null;
  if (previous && previous.declines >= MAX_DECLINES) return 'blocked';
  if (previous && now - previous.askedAt < ASK_COOLDOWN_MS) return 'too-soon';
  if (!canBeAnswered(group, Boolean(record.wasCoHost))) return 'no-hosts';

  record.request = { pending: true, askedAt: now, declines: previous?.declines ?? 0 };
  metaChanged(io, group);
  tellMyRooms(io, userId);
  return null;
};

/** A host or co-host letting someone back in, or saying no. */
export const answerRejoin = (
  io: Server,
  group: MusicGroup,
  by: GroupMember,
  targetId: string | number | undefined,
  accept: boolean
): ModerationError | null => {
  const record = targetId == null ? undefined : formerOf(group, targetId);
  const request = record?.request;
  if (!record || !request?.pending) return 'not-found';
  if (!canManage(group, by.userId)) return 'not-allowed';
  if (record.wasCoHost && !isHost(group, by.userId)) return 'not-allowed';

  if (accept) {
    group.removedIds = group.removedIds.filter((id) => id !== record.userId);
    delete record.request;
    emitActivityMessage(io, group.id, 'member-let-in', { userName: record.userName });
  } else {
    record.request = { ...request, pending: false, declines: request.declines + 1 };
  }

  metaChanged(io, group);
  io.to(record.userId).emit('room:rejoin-answer', {
    groupId: group.id,
    name: group.name,
    accepted: accept,
  });
  tellMyRooms(io, record.userId);
  return null;
};

type Ack<T> = ((response: T) => void) | undefined;
type AskResult = { ok: true } | { ok: false; code: AskError; error: string };

export const setupRejoinHandlers = (io: Server, socket: Socket, userId: string | number): void => {
  socket.on('room:ask-rejoin', (data: { groupId?: string }, ack: Ack<AskResult>) => {
    const group = typeof data?.groupId === 'string' ? musicGroups.get(data.groupId) : undefined;
    const error = group ? askToRejoin(io, group, userId) : 'gone';
    if (typeof ack !== 'function') return;
    ack(error ? { ok: false, code: error, error: ASK_ERROR_TEXT[error] } : { ok: true });
  });
};
