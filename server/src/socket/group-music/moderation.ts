import type { Server } from 'socket.io';
import { advance } from './engine';
import { metaChanged } from './host';
import { dropMember } from './presence';
import {
  emitActivityMessage,
  findMember,
  isHost,
  liveSkipVotes,
  outranks,
  skipVotesNeeded,
  type GroupMember,
  type MusicGroup,
} from './state';

/*
 * Looking after a room: co-hosts, muting, removing people, and skipping by vote. The host makes
 * co-hosts; the host and co-hosts can mute or remove listeners (only the host can do that to a
 * co-host, and nobody to the host). Who is asking always comes from the connection.
 */

export type ModerationError = 'not-found' | 'not-allowed';

const toggle = (list: string[], id: string, on: boolean): string[] =>
  on ? (list.includes(id) ? list : [...list, id]) : list.filter((entry) => entry !== id);

export const setCoHost = (
  io: Server,
  group: MusicGroup,
  by: GroupMember,
  targetId: string | number | undefined,
  enabled: boolean
): ModerationError | null => {
  const target = findMember(group, targetId);
  if (!target) return 'not-found';
  if (!isHost(group, by.userId) || isHost(group, target.userId)) return 'not-allowed';
  const id = String(target.userId);
  if (group.coHosts.includes(id) === enabled) return null;
  group.coHosts = toggle(group.coHosts, id, enabled);
  metaChanged(io, group);
  emitActivityMessage(io, group.id, enabled ? 'cohost-added' : 'cohost-removed', {
    userName: target.userName,
  });
  return null;
};

export const setMuted = (
  io: Server,
  group: MusicGroup,
  by: GroupMember,
  targetId: string | number | undefined,
  muted: boolean
): ModerationError | null => {
  const target = findMember(group, targetId);
  if (!target) return 'not-found';
  if (!outranks(group, by.userId, target.userId)) return 'not-allowed';
  const id = String(target.userId);
  if (group.mutedIds.includes(id) === muted) return null;
  group.mutedIds = toggle(group.mutedIds, id, muted);
  metaChanged(io, group);
  emitActivityMessage(io, group.id, muted ? 'member-muted' : 'member-unmuted', {
    userName: target.userName,
  });
  return null;
};

/** Takes someone out of the room, on all their devices. An invite from a host lets them back. */
export const removeFromRoom = (
  io: Server,
  group: MusicGroup,
  by: GroupMember,
  targetId: string | number | undefined
): ModerationError | null => {
  const target = findMember(group, targetId);
  if (!target) return 'not-found';
  if (!outranks(group, by.userId, target.userId)) return 'not-allowed';
  group.removedIds = toggle(group.removedIds, String(target.userId), true);
  dropMember(io, group, target.userId, { removed: true });
  emitActivityMessage(io, group.id, 'member-removed', { userName: target.userName });
  return null;
};

/**
 * A vote to skip the song playing, or taking one back. Once enough of the room agrees the song is
 * skipped; votes lapse with the song.
 */
export const voteSkip = async (
  io: Server,
  group: MusicGroup,
  by: GroupMember,
  itemId: string
): Promise<ModerationError | null> => {
  const item = group.current;
  if (!item || item.id !== itemId) return 'not-found';
  const id = String(by.userId);
  const votes = liveSkipVotes(group);
  const voting = !votes.includes(id);
  const userIds = voting ? [...votes, id] : votes.filter((vote) => vote !== id);
  const needed = skipVotesNeeded(group);

  if (voting && userIds.length >= needed) {
    group.skipVotes = null;
    await advance(io, group, { reason: 'vote', expectedItemId: itemId, by });
    return null;
  }

  group.skipVotes = userIds.length > 0 ? { itemId, userIds } : null;
  metaChanged(io, group);
  if (voting) {
    emitActivityMessage(io, group.id, 'skip-vote', {
      userName: by.userName,
      votes: userIds.length,
      needed,
    });
  }
  return null;
};
