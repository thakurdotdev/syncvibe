import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

export const playlistKeys = {
  all: ["playlists"],
  lists: () => [...playlistKeys.all, "list"],
  list: (filters) => [...playlistKeys.lists(), filters],
  details: () => [...playlistKeys.all, "detail"],
  detail: (id) => [...playlistKeys.details(), id],
}

export const fetchUserPlaylists = async () => {
  const { data } = await axios.get(`${API_URL}/api/playlist/get`, { withCredentials: true })
  return data?.data ?? []
}

export const fetchPlaylistDetails = async (id) => {
  const { data } = await axios.get(`${API_URL}/api/playlist/details`, {
    params: { id },
    withCredentials: true,
  })
  return data.data
}

export const createPlaylist = async ({ name, description }) => {
  const { data } = await axios.post(
    `${API_URL}/api/playlist/create`,
    { name, description },
    { withCredentials: true },
  )
  return data
}

export const updatePlaylist = async ({ id, name, description }) => {
  const { data } = await axios.patch(
    `${API_URL}/api/playlist/update`,
    { id, name, description },
    { withCredentials: true },
  )
  return data
}

export const deletePlaylist = async (playlistId) => {
  const { data } = await axios.delete(`${API_URL}/api/playlist/delete`, {
    data: { playlistId },
    withCredentials: true,
  })
  return data
}

export const addSongToPlaylist = async ({ playlistId, songId, songData }) => {
  const { data } = await axios.post(
    `${API_URL}/api/playlist/add-song`,
    {
      playlistId,
      songId,
      songData: JSON.stringify(songData),
    },
    { withCredentials: true },
  )
  return data
}
