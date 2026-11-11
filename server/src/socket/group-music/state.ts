import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import type { PlanLimits } from '@/services/entitlement.service';
import { appendMessage, clearHistory } from './chat-history';
import { forgetRoom } from './room-store';
import { STOPPED, type Timeline } from './timeline';

export interface GroupMember {
  userId: string | number;
  userName: string;
  profilePic?: string;
  /** False while reconnecting, during the grace period before they count as having left. */
  connected?: boolean;
}

/** Someone who was in the room lately, so their devices can offer the way back for a while. */
export interface FormerMember {
  userId: string;
  userName: string;
  profilePic?: string;
  leftAt: number;
}

export interface QueueItem {
  id: string;
  song: Record<string, unknown>;
  addedBy: GroupMember;
  addedAt: number;
  status: 'pending' | 'playing' | 'played';
  isAutoRecommended?: boolean;
}

export type ControlMode = 'everyone' | 'host';

/** Votes to skip one song. They lapse when it stops being the one playing. */
export interface SkipVotes {
  itemId: string;
  userIds: string[];
}

export interface GroupSettings {
  allowAnyoneToAdd: boolean;
  maxQueueSize: number;
  autoPlayRecommendations: boolean;
  /** Who may play, pause, seek, skip and rearrange. Anyone can still add songs. */
  controlMode: ControlMode;
}

/**
 * A room. The server owns what is playing and where it is; devices only ask for changes.
 * Each part devices keep a copy of has a revision, so one that missed an update can tell.
 */
export interface MusicGroup {
  id: string;
  name: string;
  /** The host (owner). Passes to someone else when they leave. */
  createdBy: string | number;
  /** People the host has given the same control they have, short of the host's own settings. */
  coHosts: string[];
  /** May listen but not chat or react. Kept when they leave, so leaving doesn't undo it. */
  mutedIds: string[];
  /** Taken out of the room; they can't join again unless the host or a co-host invites them. */
  removedIds: string[];
  /** Who left, dropped out or was removed lately, by user id. Cleared when they're back. */
  formerMembers: Record<string, FormerMember>;
  skipVotes: SkipVotes | null;
  createdAt: number;
  members: GroupMember[];
  current: QueueItem | null;
  upcoming: QueueItem[];
  timeline: Timeline;
  revs: { playback: number; queue: number; meta: number };
  /** When the current song was started, to tell a late "it ended" from a real skip. */
  trackStartedAt: number;
  /** Round trip each connection last measured, by socket id. */
  rtt: Map<string, { ms: number; at: number }>;
  /** Songs played lately, so autoplay doesn't bring them straight back. */
  recentSongIds: string[];
  settings: GroupSettings;
  isFetchingRecommendations?: boolean;
  /** Waiting on recommendations before moving to the next song. */
  advancing?: boolean;
  endTimer?: NodeJS.Timeout;
  maxMembers: number;
  features: {
    realtimeChat: boolean;
    realtimeSync: boolean;
  };
  qrCode?: string;
}

export interface CreateGroupData {
  id: string;
  name: string;
  createdBy: string | number;
  userName: string;
  profilePic?: string;
  planLimits?: PlanLimits | null;
}

export const musicGroups = new Map<string, MusicGroup>();
export const userGroups = new Map<string, Set<string>>();
export const TIME_TO_REJOIN = 30000;

/** Everyone in the room: chat, presence and members. */
export const roomOf = (groupId: string) => `music-group-${groupId}`;
/** Devices on the current sync protocol. */
export const syncRoomOf = (groupId: string) => `music-group-v2-${groupId}`;
/** App and web versions from before it, which still get the events they understand. */
export const legacyRoomOf = (groupId: string) => `music-group-v1-${groupId}`;
export const allRoomsOf = (groupId: string) => [
  roomOf(groupId),
  syncRoomOf(groupId),
  legacyRoomOf(groupId),
];

export const generateGroupId = (): string => {
  const id = Math.floor(100000 + Math.random() * 900000).toString();
  return `syncvibe_${id}`;
};

export const generateQueueItemId = (): string => uuidv4();
export const generateMessageId = (): string => uuidv4();

export type ActivityType =
  | 'song-added'
  | 'song-playing'
  | 'song-skipped'
  | 'queue-ended'
  | 'user-joined'
  | 'user-left'
  | 'host-changed'
  | 'control-mode'
  | 'cohost-added'
  | 'cohost-removed'
  | 'member-muted'
  | 'member-unmuted'
  | 'member-removed'
  | 'skip-vote'
  | 'skipped-by-vote';

export const emitActivityMessage = (
  io: Server,
  groupId: string,
  activityType: ActivityType,
  data: {
    userName?: string;
    songName?: string;
    addedBy?: string;
    hostOnly?: boolean;
    votes?: number;
    needed?: number;
  }
): void => {
  const group = musicGroups.get(groupId);
  if (!group?.features?.realtimeChat) return;

  const activityMessages: Record<ActivityType, string> = {
    'song-added': `${data.userName} added "${data.songName}" to the queue`,
    'song-playing': `Now playing "${data.songName}"${data.addedBy ? ` (added by ${data.addedBy})` : ''}`,
    'song-skipped': `${data.userName || 'Someone'} skipped to the next song`,
    'queue-ended': `Queue ended — add more songs!`,
    'user-joined': `${data.userName} joined the session`,
    'user-left': `${data.userName} left the session`,
    'host-changed': `${data.userName} is now the host`,
    'control-mode': data.hostOnly
      ? 'Only the hosts can control playback now'
      : 'Everyone can control playback now',
    'cohost-added': `${data.userName} is now a co-host`,
    'cohost-removed': `${data.userName} is no longer a co-host`,
    'member-muted': `${data.userName} was muted`,
    'member-unmuted': `${data.userName} can chat again`,
    'member-removed': `${data.userName} was removed from the room`,
    'skip-vote': `${data.userName} voted to skip (${data.votes}/${data.needed})`,
    'skipped-by-vote': `Skipped "${data.songName}" by vote`,
  };

  const message = activityMessages[activityType];
  if (!message) return;

  const activity = {
    id: generateMessageId(),
    groupId,
    type: 'activity',
    activityType,
    message,
    timestamp: Date.now(),
  };
  appendMessage(groupId, activity);
  io.to(roomOf(groupId)).emit('new-message', activity);
};

/** Deletes a room and everything stored for it. */
export const removeGroup = (groupId: string): void => {
  const group = musicGroups.get(groupId);
  if (group?.endTimer) clearTimeout(group.endTimer);
  musicGroups.delete(groupId);
  clearHistory(groupId);
  forgetRoom(groupId);
};

export const getGroup = (groupId: string): MusicGroup | undefined => musicGroups.get(groupId);

/** The owner: the one host who can change the room's settings and hand it over. */
export const isHost = (group: MusicGroup, userId: string | number | undefined): boolean =>
  userId != null && String(group.createdBy) === String(userId);

export const isCoHost = (group: MusicGroup, userId: string | number | undefined): boolean =>
  userId != null && group.coHosts.includes(String(userId));

/** The host or a co-host: controls playback in host-only mode and looks after the room. */
export const canManage = (group: MusicGroup, userId: string | number | undefined): boolean =>
  isHost(group, userId) || isCoHost(group, userId);

/** Whether one person may mute or remove another: the host anyone, a co-host only listeners. */
export const outranks = (
  group: MusicGroup,
  actorId: string | number | undefined,
  targetId: string | number | undefined
): boolean => {
  if (actorId == null || targetId == null || String(actorId) === String(targetId)) return false;
  if (isHost(group, targetId)) return false;
  if (isHost(group, actorId)) return true;
  return isCoHost(group, actorId) && !isCoHost(group, targetId);
};

export const isMuted = (group: MusicGroup, userId: string | number | undefined): boolean =>
  userId != null && group.mutedIds.includes(String(userId));

/** Votes needed to skip: half of those connected, at least two, at most all of them. */
export const skipVotesNeeded = (group: MusicGroup): number => {
  const connected = group.members.filter((m) => m.connected !== false).length;
  return Math.max(1, Math.min(connected, Math.max(2, Math.ceil(connected / 2))));
};

/** Votes that still count: for the song playing, from people still in the room. */
export const liveSkipVotes = (group: MusicGroup): string[] => {
  const votes = group.skipVotes;
  if (!votes || votes.itemId !== group.current?.id) return [];
  return votes.userIds.filter((id) => group.members.some((m) => String(m.userId) === id));
};

export const findMember = (
  group: MusicGroup,
  userId: string | number | undefined
): GroupMember | undefined =>
  userId == null ? undefined : group.members.find((m) => String(m.userId) === String(userId));

export const trackUserGroup = (userId: string | number, groupId: string): void => {
  const key = String(userId);
  if (!userGroups.has(key)) {
    userGroups.set(key, new Set());
  }
  userGroups.get(key)!.add(groupId);
};

export const untrackUserGroup = (userId: string | number, groupId: string): void => {
  const key = String(userId);
  const groups = userGroups.get(key);
  if (groups) {
    groups.delete(groupId);
    if (groups.size === 0) {
      userGroups.delete(key);
    }
  }
};

export const getUserGroups = (userId: string | number): Set<string> => {
  const key = String(userId);
  return userGroups.get(key) || new Set();
};

export const createGroupState = (data: CreateGroupData): MusicGroup => ({
  id: data.id,
  name: data.name,
  createdBy: data.createdBy,
  createdAt: Date.now(),
  members: [
    {
      userId: data.createdBy,
      userName: data.userName,
      profilePic: data.profilePic,
    },
  ],
  coHosts: [],
  mutedIds: [],
  removedIds: [],
  formerMembers: {},
  skipVotes: null,
  current: null,
  upcoming: [],
  timeline: { ...STOPPED },
  revs: { playback: 1, queue: 1, meta: 1 },
  trackStartedAt: 0,
  rtt: new Map(),
  recentSongIds: [],
  settings: {
    allowAnyoneToAdd: true,
    maxQueueSize: data.planLimits?.realtimeSyncEnabled ? 50 : 3,
    autoPlayRecommendations: true,
    controlMode: 'everyone',
  },
  maxMembers: data.planLimits?.maxGroupMembers || 2,
  features: {
    realtimeChat: data.planLimits?.realtimeChatEnabled || false,
    realtimeSync: data.planLimits?.realtimeSyncEnabled || false,
  },
});
