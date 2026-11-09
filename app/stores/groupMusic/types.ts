import { Song } from '@/types/song';

export interface GroupMember {
  /** False while reconnecting, before they count as having left. */
  connected?: boolean;
  groupId: string;
  userId: number;
  userName: string;
  profilePic: string;
}

export interface Group {
  id: string;
  name: string;
  createdBy: number | string;
  qrCode?: string;
  members?: GroupMember[];
  queue?: QueueItem[];
  currentQueueIndex?: number;
  maxMembers?: number;
  features?: {
    realtimeChat?: boolean;
    realtimeSync?: boolean;
  };
  settings?: {
    maxQueueSize: number;
    allowAnyoneToAdd: boolean;
    autoPlayRecommendations?: boolean;
    /** Who may play, pause, seek, skip and rearrange. Anyone can still add songs. */
    controlMode?: 'everyone' | 'host';
  };
}

export interface QueueItem {
  id: string;
  song: Song;
  addedBy: {
    userId: number | string;
    userName: string;
    profilePic: string;
    isSystem?: boolean;
  };
  addedAt: number;
  status: 'pending' | 'playing' | 'played';
  isAutoRecommended?: boolean;
}

/** Compact copy of the message being replied to (server keeps it bounded). */
export interface ReplyRef {
  id: string;
  senderId?: number | string;
  userName?: string;
  message?: string;
  messageType?: string;
}

export interface Reactor {
  userId: number | string;
  userName?: string;
}

/** emoji → people who reacted with it. Owned by the server; clients replace it wholesale. */
export type MessageReactions = Record<string, Reactor[]>;

export interface Message {
  id: string;
  groupId: string;
  senderId?: number | string;
  profilePic?: string;
  userName?: string;
  message: string;
  messageType?: 'text' | 'gif' | 'sound' | 'activity';
  gifUrl?: string;
  soundUrl?: string;
  soundName?: string;
  soundId?: string;
  timestamp: number;
  type?: 'text' | 'activity';
  activityType?: string;
  replyTo?: ReplyRef | null;
  reactions?: MessageReactions;
}

export interface ActiveSoundEffect {
  id: string;
  soundName: string;
  soundUrl: string;
  userName: string;
  profilePic?: string;
  senderId?: number | string;
  timestamp: number;
}
