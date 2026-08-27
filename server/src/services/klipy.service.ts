import { cache } from '@/utils/redis';

const KLIPY_BASE_URL = 'https://api.klipy.com/api/v1';
const TRENDING_TTL = 600;
const SEARCH_TTL = 120;
const CACHE_PREFIX = 'klipy:v2';

interface MemoryCacheEntry {
  value: NormalizedGif[];
  expiry: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

const getFromMemoryCache = (key: string): NormalizedGif[] | null => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
};

const setInMemoryCache = (key: string, value: NormalizedGif[], ttlSeconds: number): void => {
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
};

export interface NormalizedGif {
  id: string;
  title: string;
  still: string;
  animated: string;
  full: string;
  width: number;
  height: number;
  aspectRatio: number;
}

interface KlipyFileVariant {
  url?: string;
  width?: number;
  height?: number;
}

interface KlipyFileSize {
  gif?: KlipyFileVariant;
  webp?: KlipyFileVariant;
  jpg?: KlipyFileVariant;
  mp4?: KlipyFileVariant;
}

interface KlipyItem {
  id?: string | number;
  slug?: string;
  title?: string;
  url?: string;
  blur_preview?: string;
  file?: { hd?: KlipyFileSize; md?: KlipyFileSize; sm?: KlipyFileSize; xs?: KlipyFileSize };
  images?: Record<string, { url?: string; width?: string | number; height?: string | number }>;
  media_formats?: Record<string, { url?: string }>;
}

const normalizeKlipyGif = (item: KlipyItem): NormalizedGif | null => {
  if (!item) return null;

  const id = String(item.id ?? item.slug ?? Math.random().toString(36).slice(2));
  const title = item.title ?? '';

  const still =
    item.file?.sm?.jpg?.url ??
    item.file?.md?.jpg?.url ??
    item.file?.hd?.jpg?.url ??
    item.file?.xs?.jpg?.url ??
    item.file?.sm?.webp?.url ??
    item.file?.sm?.gif?.url ??
    item.images?.fixed_width_still?.url ??
    item.images?.preview?.url ??
    item.media_formats?.nanogif?.url ??
    item.media_formats?.tinygif?.url ??
    item.blur_preview ??
    item.url ??
    '';

  const animated =
    item.file?.sm?.gif?.url ??
    item.file?.md?.gif?.url ??
    item.file?.sm?.webp?.url ??
    item.file?.hd?.gif?.url ??
    item.file?.xs?.gif?.url ??
    item.images?.fixed_width?.url ??
    item.media_formats?.tinygif?.url ??
    item.media_formats?.mediumgif?.url ??
    item.url ??
    still;

  const full =
    item.file?.hd?.gif?.url ??
    item.file?.md?.gif?.url ??
    item.file?.sm?.gif?.url ??
    item.file?.hd?.webp?.url ??
    item.images?.original?.url ??
    item.media_formats?.gif?.url ??
    item.url ??
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

  return { id, title, still, animated, full, width, height, aspectRatio };
};

const extractItems = (json: unknown): KlipyItem[] => {
  if (!json) return [];
  if (Array.isArray(json)) return json as KlipyItem[];
  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as KlipyItem[];
  if (obj.data && Array.isArray((obj.data as Record<string, unknown>).data)) {
    return (obj.data as Record<string, unknown>).data as KlipyItem[];
  }
  if (Array.isArray(obj.results)) return obj.results as KlipyItem[];
  return [];
};

export const getTrendingGifs = async (page = 1, perPage = 30): Promise<NormalizedGif[]> => {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    console.warn('[KLIPY] KLIPY_API_KEY not configured in environment');
    return [];
  }

  const cacheKey = `${CACHE_PREFIX}:trending:${page}:${perPage}`;

  const cachedRedis = await cache.get<NormalizedGif[]>(cacheKey);
  if (Array.isArray(cachedRedis) && cachedRedis.length > 0) {
    return cachedRedis;
  }

  const cachedMemory = getFromMemoryCache(cacheKey);
  if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
    return cachedMemory;
  }

  try {
    const url = `${KLIPY_BASE_URL}/${apiKey}/gifs/trending?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      console.error(`[KLIPY] Trending API error (${response.status}):`, await response.text());
      return [];
    }

    const data: unknown = await response.json();
    const rawItems = extractItems(data);
    const normalized = rawItems
      .map(normalizeKlipyGif)
      .filter((g): g is NormalizedGif => g !== null);

    if (normalized.length > 0) {
      await cache.set(cacheKey, normalized, TRENDING_TTL);
      setInMemoryCache(cacheKey, normalized, TRENDING_TTL);
    }

    return normalized;
  } catch (error) {
    console.error('[KLIPY] Failed to fetch trending GIFs:', (error as Error).message);
    return [];
  }
};

export const searchGifs = async (
  query: string,
  page = 1,
  perPage = 30
): Promise<NormalizedGif[]> => {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey || !query?.trim()) {
    return [];
  }

  const cleanQuery = query.trim().toLowerCase();
  const cacheKey = `${CACHE_PREFIX}:search:${cleanQuery}:${page}:${perPage}`;

  const cachedRedis = await cache.get<NormalizedGif[]>(cacheKey);
  if (Array.isArray(cachedRedis) && cachedRedis.length > 0) {
    return cachedRedis;
  }

  const cachedMemory = getFromMemoryCache(cacheKey);
  if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
    return cachedMemory;
  }

  try {
    const url = `${KLIPY_BASE_URL}/${apiKey}/gifs/search?q=${encodeURIComponent(cleanQuery)}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      console.error(`[KLIPY] Search API error (${response.status}):`, await response.text());
      return [];
    }

    const data: unknown = await response.json();
    const rawItems = extractItems(data);
    const normalized = rawItems
      .map(normalizeKlipyGif)
      .filter((g): g is NormalizedGif => g !== null);

    if (normalized.length > 0) {
      await cache.set(cacheKey, normalized, SEARCH_TTL);
      setInMemoryCache(cacheKey, normalized, SEARCH_TTL);
    }

    return normalized;
  } catch (error) {
    console.error('[KLIPY] Failed to search GIFs:', (error as Error).message);
    return [];
  }
};
