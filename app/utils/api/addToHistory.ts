import { API_URL } from '@/constants';
import { Song } from '@/types/song';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    // Get token directly from AsyncStorage
    const token = await AsyncStorage.getItem('token');

    // Create headers with token if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

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
