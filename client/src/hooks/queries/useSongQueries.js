import { useQuery } from "@tanstack/react-query"
import {
  fetchAlbum,
  fetchArtist,
  fetchExternalPlaylist,
  fetchSongRecommendations,
  searchSongs,
  searchSongsBackend,
  songKeys,
} from "@/api/music/songs"

export const useSearchQuery = (query, options = {}) => {
  return useQuery({
    queryKey: songKeys.search(query),
    queryFn: () => searchSongs(query),
    enabled: !!query?.trim(),
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}

export const useBackendSearchQuery = (query, options = {}) => {
  return useQuery({
    queryKey: songKeys.backendSearch(query),
    queryFn: () => searchSongsBackend(query),
    enabled: !!query?.trim(),
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}

export const useAlbumQuery = (id, options = {}) => {
  return useQuery({
    queryKey: songKeys.album(id),
    queryFn: () => fetchAlbum(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
    ...options,
  })
}

export const useArtistQuery = (id, options = {}) => {
  return useQuery({
    queryKey: songKeys.artist(id),
    queryFn: () => fetchArtist(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
    ...options,
  })
}

export const useExternalPlaylistQuery = (id, options = {}) => {
  return useQuery({
    queryKey: songKeys.externalPlaylist(id),
    queryFn: () => fetchExternalPlaylist(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
    ...options,
  })
}

export const useSongRecommendationsQuery = (id, options = {}) => {
  return useQuery({
    queryKey: songKeys.recommendations(id),
    queryFn: () => fetchSongRecommendations(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}
