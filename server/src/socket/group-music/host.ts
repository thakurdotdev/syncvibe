import type { Server } from 'socket.io';
import { broadcastMeta } from './broadcast';
import { emitActivityMessage, findMember, type MusicGroup } from './state';
import { pausedAt, positionAt } from './timeline';

export const metaChanged = (io: Server, group: MusicGroup): void => {
  group.revs.meta++;
  broadcastMeta(io, group);
};

/** Hands the room over. Someone giving it away stays on as a co-host. */
export const transferHost = (
  io: Server,
  group: MusicGroup,
  toUserId: string | number,
  options: { keepOldAsCoHost?: boolean } = {}
): boolean => {
  const member = findMember(group, toUserId);
  if (!member) return false;
  if (String(group.createdBy) === String(member.userId)) return true;
  const previous = String(group.createdBy);
  group.createdBy = member.userId;
  group.coHosts = group.coHosts.filter((id) => id !== String(member.userId));
  if (options.keepOldAsCoHost && findMember(group, previous) && !group.coHosts.includes(previous)) {
    group.coHosts.push(previous);
  }
  metaChanged(io, group);
  emitActivityMessage(io, group.id, 'host-changed', { userName: member.userName });
  return true;
};

/**
 * Someone has left for good. A room is never left without a host: a co-host takes over first,
 * then anyone still connected. With nobody in it the music waits where it is rather than playing
 * on to no one.
 */
export const handleMemberGone = (io: Server, group: MusicGroup, userId: string | number): void => {
  if (group.members.length === 0) {
    if (group.endTimer) clearTimeout(group.endTimer);
    group.endTimer = undefined;
    if (group.timeline?.playing) {
      const now = Date.now();
      group.timeline = pausedAt(positionAt(group.timeline, now), now);
      group.revs.playback++;
    }
    return;
  }

  const id = String(userId);
  const wasCoHost = group.coHosts.includes(id);
  const hadVote = group.skipVotes?.userIds.includes(id) ?? false;
  group.coHosts = group.coHosts.filter((coHost) => coHost !== id);
  if (group.skipVotes && hadVote) {
    group.skipVotes = {
      ...group.skipVotes,
      userIds: group.skipVotes.userIds.filter((v) => v !== id),
    };
  }

  if (String(group.createdBy) !== id) {
    if (wasCoHost || hadVote) metaChanged(io, group);
    return;
  }
  const connected = group.members.filter((m) => m.connected !== false);
  const next =
    connected.find((m) => group.coHosts.includes(String(m.userId))) ??
    connected[0] ??
    group.members[0]!;
  transferHost(io, group, next.userId);
};
