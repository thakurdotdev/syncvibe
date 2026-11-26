import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import {
  getSavedRooms,
  patchSavedRoom,
  postSavedRoom,
  postSessionPlaylist,
  removeSavedRoom,
} from './rooms.controller';

export const roomsRouter: Router = Router();

// Rooms a host keeps between sessions
roomsRouter.get('/rooms/saved', authMiddleware, getSavedRooms);
roomsRouter.post('/rooms/saved', authMiddleware, postSavedRoom);
roomsRouter.patch('/rooms/saved/:id', authMiddleware, patchSavedRoom);
roomsRouter.delete('/rooms/saved/:id', authMiddleware, removeSavedRoom);

// What a room played, as one of your playlists
roomsRouter.post('/rooms/:groupId/playlist', authMiddleware, postSessionPlaylist);
