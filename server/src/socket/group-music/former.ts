import type { FormerMember, GroupMember, MusicGroup } from './state';

/*
 * People who were in a room lately: they left, lost their connection for good, or were removed.
 * Their devices offer the way back for a while, so the record lapses after FORMER_TTL_MS and goes
 * as soon as they are back in.
 */

export const FORMER_TTL_MS = 3 * 60 * 60 * 1000;

const isFresh = (record: FormerMember, now: number) => now - record.leftAt < FORMER_TTL_MS;

const prune = (group: MusicGroup, now: number): void => {
  for (const [id, record] of Object.entries(group.formerMembers)) {
    if (!isFresh(record, now)) delete group.formerMembers[id];
  }
};

/** Remembers someone leaving the room, however they left. */
export const noteDeparture = (
  group: MusicGroup,
  member: GroupMember,
  options: { wasCoHost?: boolean } = {},
  now = Date.now()
): void => {
  prune(group, now);
  const userId = String(member.userId);
  group.formerMembers[userId] = {
    userId,
    userName: member.userName,
    profilePic: member.profilePic,
    leftAt: now,
    ...(options.wasCoHost ? { wasCoHost: true } : {}),
  };
};

/** They're back, or don't want to be offered the room any more. Returns whether there was one. */
export const forgetFormer = (group: MusicGroup, userId: string | number): boolean => {
  const key = String(userId);
  if (!group.formerMembers[key]) return false;
  delete group.formerMembers[key];
  return true;
};

export const formerOf = (
  group: MusicGroup,
  userId: string | number,
  now = Date.now()
): FormerMember | undefined => {
  const record = group.formerMembers[String(userId)];
  return record && isFresh(record, now) ? record : undefined;
};

/** Requests waiting for an answer, as the room's hosts see them. */
export const pendingRequestsOf = (group: MusicGroup, now = Date.now()) =>
  Object.values(group.formerMembers)
    .filter((record) => record.request?.pending && isFresh(record, now))
    .map((record) => ({
      userId: record.userId,
      userName: record.userName,
      profilePic: record.profilePic,
      askedAt: record.request!.askedAt,
      /** Removed while a co-host: only the host can answer. */
      hostOnly: Boolean(record.wasCoHost),
    }));

/** A host let them back in another way (an invite). Returns whether a request was waiting. */
export const settleRequest = (group: MusicGroup, userId: string | number): boolean => {
  const record = group.formerMembers[String(userId)];
  if (!record?.request) return false;
  const wasPending = record.request.pending;
  delete record.request;
  return wasPending;
};
