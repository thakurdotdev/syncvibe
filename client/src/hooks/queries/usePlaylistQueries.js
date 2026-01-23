import { useQuery } from "@tanstack/react-query"
import { fetchPlaylistDetails, fetchUserPlaylists, playlistKeys } from "@/api/music/playlist"

export const useUserPlaylistsQuery = (options = {}) => {
  return useQuery({
    queryKey: playlistKeys.lists(),
    queryFn: fetchUserPlaylists,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}

export const usePlaylistDetailsQuery = (id, options = {}) => {
  return useQuery({
    queryKey: playlistKeys.detail(id),
    queryFn: () => fetchPlaylistDetails(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}
