import axios from "axios"

const BASE_URL = import.meta.env.VITE_SOUND_EFFECTS_URL || "https://myinstants.thakur.dev"

/**
 * Curated list of high-energy quick reaction sound effects for 1-tap reactions
 */
export const QUICK_SOUND_PRESETS = [
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
 * @param {number} [page=1]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ page: number, data: Array<{ id: string, name: string, url: string }> }>}
 */
export const fetchSoundFeed = async (page = 1, signal) => {
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
 * @param {string} query
 * @param {number} [page=1]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ page: number, data: Array<{ id: string, name: string, url: string }> }>}
 */
export const searchSounds = async (query, page = 1, signal) => {
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
