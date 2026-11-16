import { SONG_URL } from '@/constants';
import type { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { api } from '@/utils/hooks/useApi';
import axios from 'axios';

/** Minutes behind UTC, so "late nights" and the weekly recap follow the phone's clock. */
const tz = () => new Date().getTimezoneOffset();
const songs = (list: Song[] | undefined) => (list ?? []).map(ensureHttpsForSongUrls);

export interface TasteArtist {
  id: string;
  name: string;
  image?: string | null;
}

export interface Taste {
  languages: string[];
  artists: TasteArtist[];
  shareListening: boolean;
  availableLanguages?: string[];
}

export interface Shelf {
  key: string;
  title: string;
  subtitle?: string;
  songs: Song[];
  reasons?: Record<string, string>;
}

export interface Mood {
  key: string;
  title: string;
}

export interface PublicUser {
  userid: number;
  name: string;
  username: string;
  profilepic: string | null;
}

export interface FriendActivity {
  user: PublicUser;
  song: Song | null;
  room: { id: string; name: string; members: number } | null;
}

export interface Blend {
  partner: PublicUser;
  songs: Song[];
  sides: Record<string, 'you' | 'them' | 'both'>;
}

export interface Recap {
  from: string;
  to: string;
  minutes: number;
  previousMinutes: number;
  daysListened: number;
  songsPlayed: number;
  discoveries: number;
  topSongs: Array<{ song: Song; plays: number }>;
  topArtists: Array<{ id: string | null; name: string; image: string | null; minutes: number }>;
  topMood: Mood | null;
  peak: 'morning' | 'afternoon' | 'evening' | 'night' | null;
}

export const getLikedIds = async (): Promise<string[]> =>
  (await api.get('/api/music/likes/ids')).data?.data?.ids ?? [];

export const getLikedSongs = async (): Promise<Song[]> =>
  songs((await api.get('/api/music/likes')).data?.data?.songs);

export const likeSong = (song: Song) => api.post('/api/music/likes', { songData: song });

export const unlikeSong = (songId: string) =>
  api.delete(`/api/music/likes/${encodeURIComponent(songId)}`);

export const getTaste = async (): Promise<Taste> => (await api.get('/api/music/taste')).data?.data;

export const saveTaste = async (taste: Partial<Taste>): Promise<Taste> =>
  (await api.put('/api/music/taste', taste)).data?.data;

export const searchArtists = async (query: string): Promise<TasteArtist[]> => {
  if (query.trim().length < 2) return [];
  const { data } = await axios.get(`${SONG_URL}/search/artists`, {
    params: { q: query.trim(), n: 8 },
  });
  return (data?.data?.results ?? [])
    .filter((artist: { id?: string; name?: string }) => artist?.id && artist?.name)
    .map((artist: { id: string; name: string; image?: Array<{ link?: string }> }) => ({
      id: artist.id,
      name: artist.name,
      image: artist.image?.[1]?.link ?? artist.image?.[0]?.link ?? null,
    }));
};

export const getShelves = async (): Promise<Shelf[]> => {
  const shelves: Shelf[] = (await api.get('/api/music/shelves', { params: { tz: tz() } })).data
    ?.data?.shelves;
  return (shelves ?? []).map((shelf) => ({ ...shelf, songs: songs(shelf.songs) }));
};

export const getMoods = async (): Promise<Mood[]> =>
  (await api.get('/api/music/moods')).data?.data?.moods ?? [];

export const getMoodStation = async (mood: string): Promise<Song[]> =>
  songs((await api.get(`/api/music/moods/${encodeURIComponent(mood)}`)).data?.data?.songs);

export const getBlend = async (userId: string | number): Promise<Blend> => {
  const blend: Blend = (await api.get(`/api/music/blend/${encodeURIComponent(String(userId))}`))
    .data?.data;
  return { ...blend, songs: songs(blend.songs) };
};

export const getFriendsNow = async (): Promise<FriendActivity[]> =>
  (await api.get('/api/music/friends/now')).data?.data?.friends ?? [];

export const getRecap = async (): Promise<Recap> =>
  (await api.get('/api/music/recap', { params: { tz: tz() } })).data?.data;
