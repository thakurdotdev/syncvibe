import { Song } from "@/types/song"

export interface GroupMember {
  groupId: string
  userId: number
  userName: string
  profilePic: string
}

export interface Group {
  id: string
  name: string
  createdBy: number
  qrCode?: string
  settings?: {
    maxQueueSize: number
    allowAnyoneToAdd: boolean
  }
}

export interface QueueItem {
  id: string
  song: Song
  addedBy: {
    userId: number | string
    userName: string
    profilePic: string
  }
  addedAt: number
  status: "pending" | "playing" | "played"
}

export interface Message {
  id: string
  groupId: string
  senderId?: number | string
  profilePic?: string
  userName?: string
  message: string
  messageType?: "text" | "gif" | "sound" | "activity"
  gifUrl?: string
  soundUrl?: string
  soundName?: string
  soundId?: string
  timestamp: number
  type?: "text" | "activity"
  activityType?: string
}

export interface ActiveSoundEffect {
  id: string
  soundName: string
  soundUrl: string
  userName: string
  profilePic?: string
  senderId?: number | string
  timestamp: number
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  currentTrack: Song | null
  lastUpdate: number
  serverTime?: number
}
