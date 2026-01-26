import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addComment,
  createPost,
  deletePost,
  hidePost,
  likeDislikePost,
  postKeys,
  updatePost,
} from "@/api/posts"

export const useCreatePostMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: postKeys.all })
    },
  })
}

export const useUpdatePostMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePost,
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({ queryKey: postKeys.all })
      queryClient.invalidateQueries({ queryKey: postKeys.detail(variables.postid) })
    },
  })
}

export const useDeletePostMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: postKeys.all })
    },
  })
}

export const useHidePostMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: hidePost,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: postKeys.all })
    },
  })
}

export const useLikeDislikeMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: likeDislikePost,
    onSuccess: (_, postid) => {
      queryClient.invalidateQueries({ queryKey: postKeys.likeStatus(postid) })
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postid) })
    },
  })
}

export const useAddCommentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addComment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: postKeys.comments(variables.postid) })
      queryClient.invalidateQueries({ queryKey: postKeys.detail(variables.postid) })
    },
  })
}
