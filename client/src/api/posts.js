import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

export const postKeys = {
  all: ["posts"],
  lists: () => [...postKeys.all, "list"],
  list: (filters) => [...postKeys.lists(), filters],
  details: () => [...postKeys.all, "detail"],
  detail: (id) => [...postKeys.details(), id],
  comments: (postId) => [...postKeys.all, "comments", postId],
  likeStatus: (postId) => [...postKeys.all, "likeStatus", postId],
  userPosts: (userId) => [...postKeys.all, "user", userId],
}

export const fetchPosts = async ({ page = 1, limit = 10 }) => {
  const { data } = await axios.get(`${API_URL}/api/posts`, {
    params: { page, limit },
    withCredentials: true,
  })
  return data
}

export const fetchUserPosts = async ({ userId, page = 1, limit = 12 }) => {
  const { data } = await axios.get(`${API_URL}/api/user/posts/${userId}`, {
    params: { page, limit },
    withCredentials: true,
  })
  return data
}

export const fetchPostById = async (postid) => {
  const { data } = await axios.get(`${API_URL}/api/post/${postid}`, {
    withCredentials: true,
  })
  return data
}

export const createPost = async ({ title, images }) => {
  const { data } = await axios.post(
    `${API_URL}/api/create`,
    { title, images },
    {
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    },
  )
  return data
}

export const updatePost = async ({ postid, title, images }) => {
  const { data } = await axios.patch(
    `${API_URL}/api/post/update/${postid}`,
    { title, images },
    {
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    },
  )
  return data
}

export const deletePost = async (postid) => {
  const { data } = await axios.delete(`${API_URL}/api/post/delete/${postid}`, {
    withCredentials: true,
  })
  return data
}

export const hidePost = async (postid) => {
  const { data } = await axios.post(
    `${API_URL}/api/post/hide/${postid}`,
    {},
    {
      withCredentials: true,
    },
  )
  return data
}

export const likeDislikePost = async (postid) => {
  const { data } = await axios.get(`${API_URL}/api/post/likedislike/${postid}`, {
    withCredentials: true,
  })
  return data
}

export const getLikeStatus = async (postid) => {
  const { data } = await axios.get(`${API_URL}/api/post/like/status/${postid}`, {
    withCredentials: true,
  })
  return data
}

export const fetchComments = async (postid) => {
  const { data } = await axios.get(`${API_URL}/api/get/comment/${postid}`, {
    withCredentials: true,
  })
  return data
}

export const addComment = async ({ comment, postid, parentCommentId }) => {
  const { data } = await axios.post(
    `${API_URL}/api/post/comment`,
    { comment, postid, parentCommentId },
    { withCredentials: true },
  )
  return data
}
