import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { fetchComments, fetchPostById, fetchPosts, getLikeStatus, postKeys } from "@/api/posts"

export const usePostsInfiniteQuery = (limit = 10, options = {}) => {
  return useInfiniteQuery({
    queryKey: postKeys.list({ limit }),
    queryFn: ({ pageParam = 1 }) => fetchPosts({ page: pageParam, limit }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((acc, page) => acc + page.posts.length, 0)
      return totalFetched < lastPage.totalPosts ? allPages.length + 1 : undefined
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  })
}

export const usePostDetailQuery = (postid, options = {}) => {
  return useQuery({
    queryKey: postKeys.detail(postid),
    queryFn: () => fetchPostById(postid),
    enabled: !!postid,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}

export const useCommentsQuery = (postid, options = {}) => {
  return useQuery({
    queryKey: postKeys.comments(postid),
    queryFn: () => fetchComments(postid),
    enabled: !!postid,
    staleTime: 1000 * 60 * 2,
    ...options,
  })
}

export const useLikeStatusQuery = (postid, options = {}) => {
  return useQuery({
    queryKey: postKeys.likeStatus(postid),
    queryFn: () => getLikeStatus(postid),
    enabled: !!postid,
    staleTime: 1000 * 60 * 5,
    ...options,
  })
}
