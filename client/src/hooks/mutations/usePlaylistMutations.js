import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  playlistKeys,
  removeSongFromPlaylist,
  updatePlaylist,
} from "@/api/music/playlist"

export const useCreatePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options

  return useMutation({
    mutationFn: createPlaylist,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      userOnSuccess?.(data, variables, context)
    },
    ...restOptions,
  })
}

export const useUpdatePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options

  return useMutation({
    mutationFn: updatePlaylist,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(variables.id) })
      userOnSuccess?.(data, variables, context)
    },
    ...restOptions,
  })
}

export const useDeletePlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options

  return useMutation({
    mutationFn: deletePlaylist,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      userOnSuccess?.(data, variables, context)
    },
    ...restOptions,
  })
}

export const useAddSongToPlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options

  return useMutation({
    mutationFn: addSongToPlaylist,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(variables.playlistId) })
      userOnSuccess?.(data, variables, context)
    },
    ...restOptions,
  })
}

export const useRemoveSongFromPlaylistMutation = (options = {}) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options

  return useMutation({
    mutationFn: removeSongFromPlaylist,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() })
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(variables.playlistId) })
      userOnSuccess?.(data, variables, context)
    },
    ...restOptions,
  })
}
