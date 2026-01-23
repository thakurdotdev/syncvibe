import axios from "axios"

const SONG_URL = import.meta.env.VITE_SONG_URL

export const songKeys = {
  all: ["songs"],
  search: (query) => [...songKeys.all, "search", query],
  backendSearch: (query) => [...songKeys.all, "backendSearch", query],
  album: (id) => [...songKeys.all, "album", id],
  artist: (id) => [...songKeys.all, "artist", id],
  externalPlaylist: (id) => [...songKeys.all, "externalPlaylist", id],
  recommendations: (id) => [...songKeys.all, "recommendations", id],
  song: (id) => [...songKeys.all, "song", id],
}

export const searchSongs = async (query) => {
  if (!query?.trim()) return null
  const { data } = await axios.get(`${SONG_URL}/search?q=${query}`)
  return data?.data
}

export const searchSongsOnly = async (query) => {
  if (!query?.trim()) return null
  const { data } = await axios.get(`${SONG_URL}/search/songs?q=${query}`)
  return data?.data
}

const API_URL = import.meta.env.VITE_API_URL

export const searchSongsBackend = async (query, limit = 10) => {
  if (!query?.trim()) return null
  const { data } = await axios.get(
    `${API_URL}/api/music/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  )
  return data?.data
}

export const fetchAlbum = async (id) => {
  const { data } = await axios.get(`${SONG_URL}/album?id=${id}`)
  return data?.data
}

export const fetchArtist = async (id) => {
  const { data } = await axios.get(`${SONG_URL}/artist?id=${id}`)
  return data?.data
}

export const fetchExternalPlaylist = async (id) => {
  const { data } = await axios.get(`${SONG_URL}/playlist?id=${id}`)
  return data?.data
}

export const fetchSongRecommendations = async (id) => {
  const { data } = await axios.get(`${SONG_URL}/song/recommend?id=${id}`)
  return data?.data || []
}

export const fetchSongById = async (id) => {
  const { data } = await axios.get(`${SONG_URL}/song?id=${id}`)
  return data?.data?.[0] || data?.data
}
