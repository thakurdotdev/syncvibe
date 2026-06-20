import { API_URL, SONG_URL } from '@/constants';
import type {
  MusicHistoryResponse,
  HomePageResponse,
  RecentMusicResponse,
  MusicHistoryParams,
  PlaylistDetails,
  AlbumDetails,
  ArtistDetails,
} from '@/types/music';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import axios from 'axios';

export const getHomePageMusic = async (): Promise<HomePageResponse> => {
  const response = await axios.get(`${SONG_URL}/modules?lang=${'hindi'}`, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  return response.data.data;
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
  const response = await axios.get(`${SONG_URL}/playlist?token=${playlistId}`);
  return response.data.data ?? {};
};

export const getAlbumDetails = async (albumId: string): Promise<AlbumDetails> => {
  const response = await axios.get(`${SONG_URL}/album?token=${albumId}`);
  return response.data.data ?? {};
};

export const getArtistDetails = async (artistId: string): Promise<ArtistDetails> => {
  const response = await axios.get(`${SONG_URL}/artist?token=${artistId}`);
  return response.data.data ?? {};
};

export const searchMusic = async (query: string): Promise<Song[]> => {
  const response = await axios.get(`${SONG_URL}/search?q=${query}`);
  return response.data.data ?? [];
};

export const fetchSongRecommendations = async (api: any, id: string): Promise<Song[]> => {
  try {
    const response = await api.get(`/api/play-next/${id}?limit=20`)
    if (response?.data?.data?.length) {
      const newRecommendations = response.data.data?.map(ensureHttpsForSongUrls);
      return newRecommendations;
    } else {
      return [];
    }
  } catch (err) {
    console.log("recommendations error", err)
    return []
  }
}
