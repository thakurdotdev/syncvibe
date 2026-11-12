import type { Request, Response } from 'express';
import {
  dislikeSong,
  listDislikedSongs,
  undoDislike,
} from '@/features/music/services/dislike.service';
import { invalidateCache } from '@/features/music/services/recommendation.service';

export const addDislike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songData } = req.body as { songData?: Record<string, unknown> };
    if (!songData?.id || typeof songData.id !== 'string') {
      res.status(400).json({ success: false, error: 'songData with an id is required' });
      return;
    }
    const userId = req.user!.userid;
    await dislikeSong(userId, songData);
    // "Made for you" is cached for hours; rebuild it so the song leaves it now.
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in addDislike:', error);
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
};

export const removeDislike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    if (!songId || typeof songId !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid songId' });
      return;
    }
    const userId = req.user!.userid;
    await undoDislike(userId, songId);
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in removeDislike:', error);
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
};

export const getDislikedSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const songs = await listDislikedSongs(req.user!.userid);
    res.json({ success: true, data: { songs } });
  } catch (error) {
    console.error('Error in getDislikedSongs:', error);
    res.status(500).json({ success: false, error: 'Failed to load' });
  }
};
