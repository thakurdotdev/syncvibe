import type { Request, Response } from 'express';
import {
  dislikeArtist,
  dislikeSong,
  listDislikedArtists,
  listDislikedSongs,
  undoArtistDislike,
  undoDislike,
} from '@/features/music/services/dislike.service';
import { invalidateCache } from '@/features/music/services/recommendation.service';
import { UnknownSongError } from '@/features/music/services/catalog.service';

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
    if (error instanceof UnknownSongError) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
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

// ─── Artists ("not this artist") ─────────────────────────────────────────────

const ARTIST_ID = /^[\w-]{1,64}$/;

export const addArtistDislike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistId, name } = req.body as { artistId?: unknown; name?: unknown };
    if (typeof artistId !== 'string' || !ARTIST_ID.test(artistId) || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'artistId and name are required' });
      return;
    }
    const userId = req.user!.userid;
    await dislikeArtist(userId, { id: artistId, name: name.trim() || 'Artist' });
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in addArtistDislike:', error);
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
};

export const removeArtistDislike = async (req: Request, res: Response): Promise<void> => {
  try {
    const artistId = String(req.params.artistId ?? '');
    if (!ARTIST_ID.test(artistId)) {
      res.status(400).json({ success: false, error: 'Invalid artistId' });
      return;
    }
    const userId = req.user!.userid;
    await undoArtistDislike(userId, artistId);
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in removeArtistDislike:', error);
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
};

export const getDislikedArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: { artists: await listDislikedArtists(req.user!.userid) } });
  } catch (error) {
    console.error('Error in getDislikedArtists:', error);
    res.status(500).json({ success: false, error: 'Failed to load' });
  }
};
