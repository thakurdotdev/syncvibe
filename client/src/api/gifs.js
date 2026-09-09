import axios from 'axios';

const KLIPY_API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_KLIPY_API_URL) ||
  'https://klipy.thakur.dev';

/**
 * @typedef {'gifs' | 'stickers' | 'clips'} MediaType
 *
 * @typedef {Object} KlipyMediaItem
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} preview
 * @property {string} gif
 * @property {string} mp4
 */

/**
 * Fetch trending media items from Klipy API
 * @param {Object} [params]
 * @param {MediaType} [params.type='gifs']
 * @param {number} [params.page=1]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ data: KlipyMediaItem[], page: number, type: string }>}
 */
export const fetchTrendingMedia = async ({ type = 'gifs', page = 1, signal } = {}) => {
  try {
    const response = await axios.get(`${KLIPY_API_URL}/api/trending`, {
      params: {
        type,
        page,
      },
      signal,
      timeout: 10000,
    });
    return {
      data: response.data?.data || [],
      page: response.data?.page || page,
      type: response.data?.type || type,
    };
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    console.error(`Failed to fetch trending ${type}:`, error);
    return { data: [], page, type };
  }
};

/**
 * Search media items by keyword from Klipy API
 * @param {Object} params
 * @param {string} params.query
 * @param {MediaType} [params.type='gifs']
 * @param {number} [params.page=1]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ data: KlipyMediaItem[], page: number, type: string, query: string }>}
 */
export const searchMedia = async ({ query, type = 'gifs', page = 1, signal } = {}) => {
  const cleanQuery = query ? query.trim() : '';
  if (!cleanQuery) {
    return { data: [], page, type, query: '' };
  }

  try {
    const response = await axios.get(`${KLIPY_API_URL}/api/search`, {
      params: {
        q: cleanQuery,
        type,
        page,
      },
      signal,
      timeout: 10000,
    });
    return {
      data: response.data?.data || [],
      page: response.data?.page || page,
      type: response.data?.type || type,
      query: response.data?.query || cleanQuery,
    };
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    console.error(`Failed to search ${type} for "${cleanQuery}":`, error);
    return { data: [], page, type, query: cleanQuery };
  }
};

/**
 * Backwards compatible helper for trending GIFs
 * @param {AbortSignal} [signal]
 * @param {number} [page=1]
 * @returns {Promise<KlipyMediaItem[]>}
 */
export const fetchTrendingGifs = async (signal, page = 1) => {
  const res = await fetchTrendingMedia({ type: 'gifs', page, signal });
  return res.data;
};

/**
 * Backwards compatible helper for searching GIFs
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @param {number} [page=1]
 * @returns {Promise<KlipyMediaItem[]>}
 */
export const searchGifs = async (query, signal, page = 1) => {
  const res = await searchMedia({ query, type: 'gifs', page, signal });
  return res.data;
};
