import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  playlistKeys,
  updatePlaylist,
} from "@/api/music/playlist"

export const useCreatePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
    },
    ...options,
  })
}

export const useUpdatePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePlaylist,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(variables.id) })
    },
    ...options,
  })
}

export const useDeletePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
    },
    ...options,
  })
}

export const useAddSongToPlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addSongToPlaylist,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(variables.playlistId) })
    },
    ...options,
  })
}
