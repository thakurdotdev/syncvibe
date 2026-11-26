import { api } from '@/utils/hooks/useApi';

export interface Regular {
  userId: string;
  userName: string;
  profilePic?: string;
}

/** A room you keep between sessions. */
export interface SavedRoom {
  id: number;
  name: string;
  songCount: number;
  covers: string[];
  regulars: Regular[];
  regularCount: number;
  /** Still going from last time. */
  live: { groupId: string; listeners: number } | null;
  updatedAt: string;
}

export const getSavedRooms = async (): Promise<SavedRoom[]> =>
  (await api.get('/api/rooms/saved')).data?.data ?? [];

export const keepRoom = async (groupId: string): Promise<{ id: number }> =>
  (await api.post('/api/rooms/saved', { groupId })).data?.data;

export const forgetSavedRoom = async (id: number): Promise<void> => {
  await api.delete(`/api/rooms/saved/${id}`);
};

/** What the room has played, as one of your playlists. */
export const saveRoomPlaylist = async (
  groupId: string
): Promise<{ playlistId: number; name: string; songCount: number }> =>
  (await api.post(`/api/rooms/${encodeURIComponent(groupId)}/playlist`, {})).data?.data;
