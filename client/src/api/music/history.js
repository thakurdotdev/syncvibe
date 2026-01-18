import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

export const historyKeys = {
  all: ["history"],
  list: (filters) => [...historyKeys.all, "list", filters],
}

export const fetchHistory = async ({
  page = 1,
  limit = 21,
  sortBy = "lastPlayedAt",
  sortOrder = "DESC",
  searchQuery = "",
}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  })

  if (searchQuery.trim()) {
    params.append("searchQuery", searchQuery.trim())
  }

  const { data } = await axios.get(`${API_URL}/api/music/latestHistory?${params}`, {
    withCredentials: true,
  })

  if (data?.status !== "success") {
    throw new Error("Failed to fetch history")
  }

  return data.data
}

export const addToHistory = async ({ songData, playedTime, trackingType }) => {
  const { data } = await axios.post(
    `${API_URL}/api/history/add`,
    { songData, playedTime, trackingType },
    { withCredentials: true },
  )
  return data
}
