import { API_URL } from '@/constants';
import axios from 'axios';

export interface GifItem {
  id: string;
  title: string;
  still: string;
  animated: string;
  full: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

/**
 * Fetch trending GIFs from backend proxy
 */
export const fetchTrendingGifs = async (): Promise<GifItem[]> => {
  try {
    const response = await axios.get(`${API_URL}/api/gifs/trending`, {
      timeout: 8000,
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Failed to fetch trending GIFs:', error);
    return [];
  }
};

/**
 * Search GIFs by query from backend proxy
 */
export const searchGifs = async (query: string): Promise<GifItem[]> => {
  if (!query || !query.trim()) {
    return [];
  }
  try {
    const response = await axios.get(`${API_URL}/api/gifs/search`, {
      params: { q: query.trim() },
      timeout: 8000,
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Failed to search GIFs:', error);
    return [];
  }
};
