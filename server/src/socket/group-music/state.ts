import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import type { PlanLimits } from '@/services/entitlement.service';

export interface GroupMember {
  userId: string | number;
  userName: string;
  profilePic?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentTrack: unknown;
  lastUpdate: number;
  serverTime?: number;
}

export interface QueueItem {
  id: string;
  song: Record<string, unknown>;
  addedBy: GroupMember;
  addedAt: number;
  status: 'pending' | 'playing' | 'played';
}

export interface MusicGroup {
  id: string;
  name: string;
  createdBy: string | number;
  createdAt: number;
  members: GroupMember[];
  queue: QueueItem[];
  currentQueueIndex: number;
  currentSongId: string | null;
  playbackState: PlaybackState;
  memberRTT: Map<string | number, number>;
  settings: {
    allowAnyoneToAdd: boolean;
    maxQueueSize: number;
  };
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
export const TIME_TO_REJOIN = 10000;

export const generateGroupId = (): string => {
  const id = Math.floor(100000 + Math.random() * 900000).toString();
  return `syncvibe_${id}`;
};

export const generateQueueItemId = (): string => uuidv4();
export const generateMessageId = (): string => uuidv4();

export const emitActivityMessage = (
  io: Server,
  groupId: string,
  activityType:
    | 'song-added'
    | 'song-playing'
    | 'song-skipped'
    | 'queue-ended'
    | 'user-joined'
    | 'user-left',
  data: { userName?: string; songName?: string; addedBy?: string }
): void => {
  const group = musicGroups.get(groupId);
  if (!group?.features?.realtimeChat) return;

  const activityMessages: Record<string, string> = {
    'song-added': `${data.userName} added "${data.songName}" to the queue`,
    'song-playing': `Now playing "${data.songName}"${data.addedBy ? ` (added by ${data.addedBy})` : ''}`,
    'song-skipped': `${data.userName || 'Someone'} skipped to the next song`,
    'queue-ended': `Queue ended — add more songs!`,
    'user-joined': `${data.userName} joined the session`,
    'user-left': `${data.userName} left the session`,
  };

  const message = activityMessages[activityType];
  if (!message) return;

  io.to(`music-group-${groupId}`).emit('new-message', {
    id: generateMessageId(),
    groupId,
    type: 'activity',
    activityType,
    message,
    timestamp: Date.now(),
  });
};

export const getGroup = (groupId: string): MusicGroup | undefined => musicGroups.get(groupId);

export const getScheduledDelay = (group?: MusicGroup): number => {
  if (!group || group.memberRTT.size === 0) return 1500;
  let maxRTT = 0;
  for (const rtt of group.memberRTT.values()) {
    if (rtt > maxRTT) maxRTT = rtt;
  }
  return Math.max(800, Math.min(2500, maxRTT * 2 + 300));
};

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
  queue: [],
  currentQueueIndex: -1,
  currentSongId: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentTrack: null,
    lastUpdate: Date.now(),
  },
  memberRTT: new Map(),
  settings: {
    allowAnyoneToAdd: true,
    maxQueueSize: data.planLimits?.realtimeSyncEnabled ? 50 : 3,
  },
  maxMembers: data.planLimits?.maxGroupMembers || 2,
  features: {
    realtimeChat: data.planLimits?.realtimeChatEnabled || false,
    realtimeSync: data.planLimits?.realtimeSyncEnabled || false,
  },
});
