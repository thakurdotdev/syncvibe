import type { MusicGroup, PendingInvite } from './state';

/*
 * Invites a room is waiting on. Everyone in the room sees them in its meta (`pendingInvites`), so
 * nobody invites the same person twice. One ends when the person joins, declines or it expires;
 * the stored `GroupInvite` row has the same lifetime.
 */

export const INVITE_TTL_MS = 5 * 60 * 1000;

/** Invites still waiting. Expired ones are dropped as they're read. */
export const pendingInvitesOf = (group: MusicGroup, now = Date.now()): PendingInvite[] => {
  for (const [id, invite] of Object.entries(group.invites)) {
    if (invite.expiresAt <= now) delete group.invites[id];
  }
  return Object.values(group.invites).sort((a, b) => b.invitedAt - a.invitedAt);
};

/** Notes an invite; inviting someone again starts their wait over. */
export const noteInvite = (
  group: MusicGroup,
  invitee: { userId: string | number; userName: string; profilePic?: string | null },
  by: { userId: string | number; userName?: string },
  now = Date.now()
): PendingInvite => {
  const invite: PendingInvite = {
    userId: String(invitee.userId),
    userName: invitee.userName,
    profilePic: invitee.profilePic ?? undefined,
    invitedById: String(by.userId),
    invitedByName: by.userName,
    invitedAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };
  group.invites[invite.userId] = invite;
  return invite;
};

/** Ends someone's invite. Returns whether one was waiting. */
export const settleInvite = (group: MusicGroup, userId: string | number): boolean => {
  const key = String(userId);
  if (!group.invites[key]) return false;
  delete group.invites[key];
  return true;
};
