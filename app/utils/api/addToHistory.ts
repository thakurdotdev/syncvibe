import { API_URL } from '@/constants';
import { Song } from '@/types/song';
import { getAuthHeaders } from '@/lib/auth-client';
import axios from 'axios';

/**
 * Adds a song to the user's history
 * @param songData - Song data
 * @param playedTime - Time the song was played
 * @returns Promise<void>
 */

// Non-hook version that can be called directly
const addToHistory = async (songData: Song, playedTime: number): Promise<void> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    };

    const response = await axios.post(
      `${API_URL}/api/history/add`,
      { songData, playedTime },
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error('Error adding song to history:', error);
  }
};

export { addToHistory };
