const { cache } = require('../utils/redis');

const KLIPY_BASE_URL = 'https://api.klipy.com/api/v1';
const TRENDING_TTL = 600; // 10 minutes
const SEARCH_TTL = 120; // 2 minutes
const CACHE_PREFIX = 'klipy:v2';

// In-memory fallback cache when Redis is not available
const memoryCache = new Map();

const getFromMemoryCache = (key) => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
};

const setInMemoryCache = (key, value, ttlSeconds) => {
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
};

/**
 * Normalizes Klipy media items according to official Klipy REST API schema:
 * item.file: { hd: { gif, webp, jpg, mp4 }, md: {...}, sm: {...}, xs: {...} }
 */
const normalizeKlipyGif = (item) => {
  if (!item) return null;

  const id = String(item.id || item.slug || Math.random().toString(36).slice(2));
  const title = item.title || '';

  // 1. Still thumbnail image (jpg/webp/blur)
  const still =
    item.file?.sm?.jpg?.url ||
    item.file?.md?.jpg?.url ||
    item.file?.hd?.jpg?.url ||
    item.file?.xs?.jpg?.url ||
    item.file?.sm?.webp?.url ||
    item.file?.sm?.gif?.url ||
    item.images?.fixed_width_still?.url ||
    item.images?.preview?.url ||
    item.media_formats?.nanogif?.url ||
    item.media_formats?.tinygif?.url ||
    item.blur_preview ||
    item.url ||
    '';

  // 2. Animated GIF for picker grid
  const animated =
    item.file?.sm?.gif?.url ||
    item.file?.md?.gif?.url ||
    item.file?.sm?.webp?.url ||
    item.file?.hd?.gif?.url ||
    item.file?.xs?.gif?.url ||
    item.images?.fixed_width?.url ||
    item.media_formats?.tinygif?.url ||
    item.media_formats?.mediumgif?.url ||
    item.url ||
    still;

  // 3. High quality GIF for sending in chat
  const full =
    item.file?.hd?.gif?.url ||
    item.file?.md?.gif?.url ||
    item.file?.sm?.gif?.url ||
    item.file?.hd?.webp?.url ||
    item.images?.original?.url ||
    item.media_formats?.gif?.url ||
    item.url ||
    animated;

  const width =
    Number(item.file?.sm?.gif?.width) ||
    Number(item.file?.md?.gif?.width) ||
    Number(item.file?.hd?.gif?.width) ||
    Number(item.images?.fixed_width?.width) ||
    200;

  const height =
    Number(item.file?.sm?.gif?.height) ||
    Number(item.file?.md?.gif?.height) ||
    Number(item.file?.hd?.gif?.height) ||
    Number(item.images?.fixed_width?.height) ||
    200;

  const aspectRatio = width && height ? width / height : 1;

  return {
    id,
    title,
    still,
    animated,
    full,
    width,
    height,
    aspectRatio,
  };
};

const extractItems = (json) => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (json.data && Array.isArray(json.data.data)) return json.data.data;
  if (Array.isArray(json.results)) return json.results;
  return [];
};

/**
 * Fetch trending GIFs with Redis and memory caching
 */
const getTrendingGifs = async (page = 1, perPage = 30) => {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    console.warn('[KLIPY] KLIPY_API_KEY not configured in environment');
    return [];
  }

  const cacheKey = `${CACHE_PREFIX}:trending:${page}:${perPage}`;

  // 1. Try Redis cache (only accept non-empty results)
  const cachedRedis = await cache.get(cacheKey);
  if (Array.isArray(cachedRedis) && cachedRedis.length > 0) {
    return cachedRedis;
  }

  // 2. Try In-memory fallback (only accept non-empty results)
  const cachedMemory = getFromMemoryCache(cacheKey);
  if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
    return cachedMemory;
  }

  try {
    const url = `${KLIPY_BASE_URL}/${apiKey}/gifs/trending?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[KLIPY] Trending API error (${response.status}):`, await response.text());
      return [];
    }

    const data = await response.json();
    const rawItems = extractItems(data);
    const normalized = rawItems.map(normalizeKlipyGif).filter(Boolean);

    // Only cache if there is actual valid data
    if (Array.isArray(normalized) && normalized.length > 0) {
      await cache.set(cacheKey, normalized, TRENDING_TTL);
      setInMemoryCache(cacheKey, normalized, TRENDING_TTL);
    }

    return normalized;
  } catch (error) {
    console.error('[KLIPY] Failed to fetch trending GIFs:', error.message);
    return [];
  }
};

/**
 * Search GIFs with Redis and memory caching
 */
const searchGifs = async (query, page = 1, perPage = 30) => {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey || !query || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim().toLowerCase();
  const cacheKey = `${CACHE_PREFIX}:search:${cleanQuery}:${page}:${perPage}`;

  // 1. Try Redis cache (only accept non-empty results)
  const cachedRedis = await cache.get(cacheKey);
  if (Array.isArray(cachedRedis) && cachedRedis.length > 0) {
    return cachedRedis;
  }

  // 2. Try In-memory fallback (only accept non-empty results)
  const cachedMemory = getFromMemoryCache(cacheKey);
  if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
    return cachedMemory;
  }

  try {
    const url = `${KLIPY_BASE_URL}/${apiKey}/gifs/search?q=${encodeURIComponent(
      cleanQuery
    )}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[KLIPY] Search API error (${response.status}):`, await response.text());
      return [];
    }

    const data = await response.json();
    const rawItems = extractItems(data);
    const normalized = rawItems.map(normalizeKlipyGif).filter(Boolean);

    // Only cache if there is actual valid data
    if (Array.isArray(normalized) && normalized.length > 0) {
      await cache.set(cacheKey, normalized, SEARCH_TTL);
      setInMemoryCache(cacheKey, normalized, SEARCH_TTL);
    }

    return normalized;
  } catch (error) {
    console.error('[KLIPY] Failed to search GIFs:', error.message);
    return [];
  }
};

module.exports = {
  getTrendingGifs,
  searchGifs,
};
