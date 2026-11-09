import type { Server } from 'socket.io';
import { broadcastMeta } from './broadcast';
import { emitActivityMessage, findMember, type MusicGroup } from './state';
import { pausedAt, positionAt } from './timeline';

export const metaChanged = (io: Server, group: MusicGroup): void => {
  group.revs.meta++;
  broadcastMeta(io, group);
};

export const transferHost = (io: Server, group: MusicGroup, toUserId: string | number): boolean => {
  const member = findMember(group, toUserId);
  if (!member) return false;
  if (String(group.createdBy) === String(member.userId)) return true;
  group.createdBy = member.userId;
  metaChanged(io, group);
  emitActivityMessage(io, group.id, 'host-changed', { userName: member.userName });
  return true;
};

/**
 * Someone has left for good. A room is never left without a host, and with nobody in it the music
 * waits where it is rather than playing on to no one.
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
  if (String(group.createdBy) !== String(userId)) return;
  const next = group.members.find((m) => m.connected !== false) ?? group.members[0]!;
  transferHost(io, group, next.userId);
};
