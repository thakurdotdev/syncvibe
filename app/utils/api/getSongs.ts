import { SONG_URL } from '@/constants';
import { Song } from '@/types/song';
import axios from 'axios';
import { ensureHttpsForSongUrls } from '../getHttpsUrls';

/**
 * Searches for songs based on a query string
 * @param query - Search term
 * @returns Array of songs
 */
export const searchSongs = async (query: string): Promise<Song[]> => {
  try {
    const { data } = await axios.get(`${SONG_URL}/search/songs`, {
      params: { q: query },
    });

    return (data?.data?.results || []).map(ensureHttpsForSongUrls);
  } catch {
    return [];
  }
};
