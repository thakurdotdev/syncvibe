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
export const noteDeparture = (group: MusicGroup, member: GroupMember, now = Date.now()): void => {
  prune(group, now);
  const userId = String(member.userId);
  group.formerMembers[userId] = {
    userId,
    userName: member.userName,
    profilePic: member.profilePic,
    leftAt: now,
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
