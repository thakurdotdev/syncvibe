import axios from "axios"

const SONG_URL = import.meta.env.VITE_SONG_URL
const API_URL = import.meta.env.VITE_API_URL

export const homepageKeys = {
  all: ["homepage"],
  modules: () => [...homepageKeys.all, "modules"],
  recommendations: () => [...homepageKeys.all, "recommendations"],
}

export const fetchHomepageModules = async () => {
  const { data } = await axios.get(`${SONG_URL}/modules?lang=hindi&mini=true`)
  const topAllData = data?.data

  return {
    trending: topAllData?.trending?.data || [],
    playlists: topAllData?.playlists?.data || [],
    albums: topAllData?.albums?.data || [],
    charts: topAllData?.charts?.data || [],
    artists: topAllData?.artist_recos?.data || [],
    bhakti: topAllData?.promo8?.data || [],
  }
}

export const fetchRecommendations = async () => {
  const { data } = await axios.get(`${API_URL}/api/music/recommendations`, {
    withCredentials: true,
  })

  return {
    songs: data?.data?.songs || [],
    recentlyPlayed: data?.data?.recentlyPlayed || [],
  }
}
