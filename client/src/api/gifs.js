import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetch trending GIFs from backend proxy
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ id: string, title: string, still: string, animated: string, full: string, width: number, height: number, aspectRatio: number }>>}
 */
export const fetchTrendingGifs = async (signal) => {
  try {
    const response = await axios.get(`${API_URL}/api/gifs/trending`, {
      withCredentials: true,
      signal,
      timeout: 8000,
    });
    return response.data?.data || [];
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    console.error('Failed to fetch trending GIFs:', error);
    return [];
  }
};

/**
 * Search GIFs by keyword from backend proxy
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ id: string, title: string, still: string, animated: string, full: string, width: number, height: number, aspectRatio: number }>>}
 */
export const searchGifs = async (query, signal) => {
  if (!query || !query.trim()) {
    return [];
  }
  try {
    const response = await axios.get(`${API_URL}/api/gifs/search`, {
      params: { q: query.trim() },
      withCredentials: true,
      signal,
      timeout: 8000,
    });
    return response.data?.data || [];
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    console.error('Failed to search GIFs:', error);
    return [];
  }
};
