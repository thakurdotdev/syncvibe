import { SONG_URL } from '@/constants';
import type {
  AlbumDetails,
  ArtistDetails,
  HomePageResponse,
  MusicHistoryParams,
  MusicHistoryResponse,
  PlaylistDetails,
  RecentMusicResponse,
} from '@/types/music';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { markRecommendations } from '@/utils/playEvents';
import axios from 'axios';

export const getHomePageMusic = async (language = 'hindi'): Promise<HomePageResponse> => {
  const response = await axios.get(`${SONG_URL}/modules`, {
    params: { lang: language },
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  return response.data.data;
};

const fetchedSongs = new Map<string, Promise<Song>>();

/** Some home sections list songs with no audio link. This fetches the full song, once each. */
export const getFullSong = (id: string): Promise<Song> => {
  let pending = fetchedSongs.get(id);
  if (!pending) {
    pending = axios.get(`${SONG_URL}/song`, { params: { id } }).then((response) => {
      const song = response.data?.data?.songs?.[0];
      if (!song?.download_url?.length) throw new Error('Song has no audio');
      return song as Song;
    });
    pending.catch(() => fetchedSongs.delete(id));
    fetchedSongs.set(id, pending);
  }
  return pending;
};

export const getRecentMusic = async (api: any): Promise<RecentMusicResponse> => {
  const response = await api.get('/api/music/recommendations');
  return response.data.data;
};

export const getMusicHistory = async (
  api: any,
  params: MusicHistoryParams
): Promise<MusicHistoryResponse> => {
  const response = await api.get('/api/music/latestHistory', {
    params,
  });
  return response.data.data;
};

export const addToHistory = async (api: any, songData: Song, playedTime?: number) => {
  const response = await api.post(`/api/history/add`, { songData, playedTime });
  return response.data;
};

export const getRelatedSongs = async (songId: string): Promise<Song[]> => {
  const response = await axios.get(`${SONG_URL}/song/recommend?id=${songId}`);
  if (response?.data?.data?.length) {
    const newRecommendations = response.data.data?.map(ensureHttpsForSongUrls);
    return newRecommendations;
  } else {
    return [];
  }
};

export const getPlaylistDetails = async (playlistId: string): Promise<PlaylistDetails> => {
  const response = await axios.get(`${SONG_URL}/playlist?id=${playlistId}`);
  return response.data?.data ?? {};
};

export const getAlbumDetails = async (albumId: string): Promise<AlbumDetails> => {
  const response = await axios.get(`${SONG_URL}/album?id=${albumId}`);
  return response.data?.data ?? {};
};

export const getArtistDetails = async (artistId: string): Promise<ArtistDetails> => {
  const response = await axios.get(`${SONG_URL}/artist?id=${artistId}`);
  return response.data?.data ?? {};
};

export const searchMusic = async (query: string): Promise<Song[]> => {
  const response = await axios.get(`${SONG_URL}/search?q=${query}`);
  return response.data.data ?? [];
};

export const fetchSongRecommendations = async (api: any, id: string | number): Promise<Song[]> => {
  try {
    const response = await api.get(`/api/play-next/${id}?limit=20`);
    if (response?.data?.data?.length) {
      const newRecommendations = response.data.data?.map(ensureHttpsForSongUrls);
      markRecommendations(String(id), newRecommendations);
      return newRecommendations;
    } else {
      return [];
    }
  } catch (err) {
    console.log('recommendations error', err);
    return [];
  }
};

export const getGroupHistory = async (api: any, userId?: string | number): Promise<any[]> => {
  try {
    const response = await api.get(`/api/music/group-history${userId ? `?userId=${userId}` : ''}`);
    return response.data?.data || [];
  } catch (err) {
    console.log('group history error', err);
    return [];
  }
};
