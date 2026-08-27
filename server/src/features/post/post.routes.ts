import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import {
  createPost,
  getAllPosts,
  getPostById,
  getPostByUser,
  updatePost,
  deletePost,
  hidePost,
  toggleLikeDislikePost,
  getLikeDislikeStatus,
  commentPost,
  getComments,
  searchPosts,
} from './post.controller';

export const postRouter: Router = Router();

// Create Post
postRouter.post('/create', authMiddleware, createPost);
postRouter.post('/create/post', authMiddleware, createPost);
postRouter.post('/posts', authMiddleware, createPost);
postRouter.post('/post/create', authMiddleware, createPost);

// Get All Posts
postRouter.get('/posts', authMiddleware, getAllPosts);
postRouter.get('/get/posts', authMiddleware, getAllPosts);

// Search Posts (Must be before /post/:postid)
postRouter.get('/search/post', authMiddleware, searchPosts);
postRouter.get('/post/search', authMiddleware, searchPosts);
postRouter.get('/posts/search', authMiddleware, searchPosts);

// Comments (Must be before /post/:postid)
postRouter.post('/post/comment', authMiddleware, commentPost);
postRouter.post('/comment/post', authMiddleware, commentPost);
postRouter.get('/get/comment/:postid', authMiddleware, getComments);
postRouter.get('/post/comment/:postid', authMiddleware, getComments);
postRouter.get('/post/comments/:postid', authMiddleware, getComments);

// Like / Dislike Post
postRouter.get('/post/likedislike/:postid', authMiddleware, toggleLikeDislikePost);
postRouter.get('/like/post/:postid', authMiddleware, toggleLikeDislikePost);
postRouter.post('/post/likedislike/:postid', authMiddleware, toggleLikeDislikePost);
postRouter.post('/post/like/:postid', authMiddleware, toggleLikeDislikePost);

// Like Status
postRouter.get('/post/like/status/:postid', authMiddleware, getLikeDislikeStatus);
postRouter.get('/get/like/:postid', authMiddleware, getLikeDislikeStatus);

// Hide / Show Post
postRouter.get('/post/hide/:postid', authMiddleware, hidePost);
postRouter.post('/post/hide/:postid', authMiddleware, hidePost);
postRouter.patch('/hide/post/:postid', authMiddleware, hidePost);
postRouter.patch('/post/hide/:postid', authMiddleware, hidePost);

// Update Post
postRouter.patch('/post/update/:postid', authMiddleware, updatePost);
postRouter.patch('/update/post/:postid', authMiddleware, updatePost);
postRouter.put('/post/update/:postid', authMiddleware, updatePost);

// Delete Post
postRouter.delete('/post/delete/:postid', authMiddleware, deletePost);
postRouter.delete('/delete/post/:postid', authMiddleware, deletePost);

// Get Posts by User
postRouter.get('/user/posts/:userid', authMiddleware, getPostByUser);
postRouter.get('/get/posts/:userid', authMiddleware, getPostByUser);
postRouter.get('/posts/user/:userid', authMiddleware, getPostByUser);

// Parameterized Single Post by ID (Must be last in postRouter)
postRouter.get('/post/:postid', authMiddleware, getPostById);
postRouter.get('/get/post/:postid', authMiddleware, getPostById);
postRouter.patch('/post/:postid', authMiddleware, updatePost);
postRouter.put('/post/:postid', authMiddleware, updatePost);
postRouter.delete('/post/:postid', authMiddleware, deletePost);
