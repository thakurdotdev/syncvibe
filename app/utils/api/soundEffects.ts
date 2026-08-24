import axios from "axios"

const BASE_URL = "https://myinstants.thakur.dev"

export interface SoundEffectItem {
  id: string
  name: string
  url: string
}

export interface SoundPreset {
  id: string
  name: string
  query: string
}

/**
 * Curated list of high-energy quick reaction sound effects for 1-tap reactions
 */
export const QUICK_SOUND_PRESETS: SoundPreset[] = [
  { id: "vine-boom", name: "Vine Boom", query: "vine boom" },
  { id: "bruh", name: "Bruh", query: "bruh" },
  { id: "anime-wow", name: "Anime Wow", query: "anime wow" },
  { id: "sad-violin", name: "Sad Violin", query: "sad violin" },
  { id: "rizz", name: "Rizz", query: "rizz" },
  { id: "fart", name: "Fart", query: "fart" },
  { id: "gopgopgop", name: "GopGopGop", query: "gopgopgop" },
  { id: "bone-crack", name: "Bone Crack", query: "bone crack" },
  { id: "among-us", name: "Among Us", query: "among us" },
  { id: "ding", name: "Ding", query: "ding" },
]

/**
 * Fetch trending sound effects feed with pagination
 */
export const fetchSoundFeed = async (
  page = 1,
  signal?: AbortSignal,
): Promise<{ page: number; data: SoundEffectItem[] }> => {
  try {
    const response = await axios.get(`${BASE_URL}/api/feed`, {
      params: { page },
      signal,
      timeout: 8000,
    })
    return response.data || { page, data: [] }
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error
    }
    console.error("Failed to fetch sound effects feed:", error)
    return { page, data: [] }
  }
}

/**
 * Search sound effects by keyword with pagination
 */
export const searchSounds = async (
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<{ page: number; data: SoundEffectItem[] }> => {
  if (!query || !query.trim()) {
    return fetchSoundFeed(page, signal)
  }
  try {
    const response = await axios.get(`${BASE_URL}/api/search`, {
      params: {
        q: query.trim(),
        page,
      },
      signal,
      timeout: 8000,
    })
    return response.data || { page, data: [] }
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error
    }
    console.error("Failed to search sound effects:", error)
    return { page, data: [] }
  }
}
