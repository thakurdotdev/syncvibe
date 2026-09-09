import { KLIPY_API_URL } from '@/constants';
import axios from 'axios';

export type MediaType = 'gifs' | 'clips' | 'stickers';

export interface KlipyMediaItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  gif: string;
  mp4: string;
  still?: string;
  animated?: string;
  full?: string;
  aspectRatio?: number;
}

export type GifItem = KlipyMediaItem;

/**
 * Fetch trending media items from Klipy API
 */
export const fetchTrendingMedia = async ({
  type = 'gifs',
  page = 1,
}: {
  type?: MediaType;
  page?: number;
} = {}): Promise<{ data: KlipyMediaItem[]; page: number; type: string }> => {
  try {
    const response = await axios.get(`${KLIPY_API_URL}/api/trending`, {
      params: { type, page },
      timeout: 10000,
    });
    return {
      data: response.data?.data || [],
      page: response.data?.page || page,
      type: response.data?.type || type,
    };
  } catch (error) {
    console.error(`Failed to fetch trending ${type}:`, error);
    return { data: [], page, type };
  }
};

/**
 * Search media items by query from Klipy API
 */
export const searchMedia = async ({
  query,
  type = 'gifs',
  page = 1,
}: {
  query: string;
  type?: MediaType;
  page?: number;
}): Promise<{ data: KlipyMediaItem[]; page: number; type: string; query: string }> => {
  const cleanQuery = query ? query.trim() : '';
  if (!cleanQuery) {
    return { data: [], page, type, query: '' };
  }
  try {
    const response = await axios.get(`${KLIPY_API_URL}/api/search`, {
      params: { q: cleanQuery, type, page },
      timeout: 10000,
    });
    return {
      data: response.data?.data || [],
      page: response.data?.page || page,
      type: response.data?.type || type,
      query: response.data?.query || cleanQuery,
    };
  } catch (error) {
    console.error(`Failed to search ${type} for "${cleanQuery}":`, error);
    return { data: [], page, type, query: cleanQuery };
  }
};

/**
 * Backwards compatible helper for trending GIFs
 */
export const fetchTrendingGifs = async (page = 1): Promise<GifItem[]> => {
  const res = await fetchTrendingMedia({ type: 'gifs', page });
  return res.data;
};

/**
 * Backwards compatible helper for searching GIFs
 */
export const searchGifs = async (query: string, page = 1): Promise<GifItem[]> => {
  const res = await searchMedia({ query, type: 'gifs', page });
  return res.data;
};
