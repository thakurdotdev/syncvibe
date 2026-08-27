import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import {
  createStory,
  viewStories,
  getUserStories,
  getFeedStories,
  markStoriesAsViewed,
  getLatestMusic,
} from './story.controller';

export const storyRouter: Router = Router();

// Create Story
storyRouter.post('/story/create', authMiddleware, createStory);
storyRouter.post('/story', authMiddleware, createStory);
storyRouter.post('/stories', authMiddleware, createStory);

// Story Views & Feeds
storyRouter.get('/story/view/:createdby', authMiddleware, viewStories);
storyRouter.get('/story/feed', authMiddleware, getFeedStories);
storyRouter.get('/stories/feed', authMiddleware, getFeedStories);
storyRouter.get('/feed', authMiddleware, getFeedStories);

// Mark Viewed
storyRouter.post('/story/viewed', authMiddleware, markStoriesAsViewed);
storyRouter.post('/stories/viewed', authMiddleware, markStoriesAsViewed);

// Latest Story Music
storyRouter.get('/story/music/latest', getLatestMusic);
storyRouter.get('/music/story/latest', getLatestMusic);

// Parameterized User Story (Must be last)
storyRouter.get('/story/:userid', authMiddleware, getUserStories);
