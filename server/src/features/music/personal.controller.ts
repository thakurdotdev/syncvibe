import type { Request, Response } from 'express';
import { BlendError, getBlend } from './services/blend.service';
import { UnknownSongError } from './services/catalog.service';
import { friendsListeningNow } from './services/friend-activity.service';
import { likedSongIds, likeSong, listLikedSongs, unlikeSong } from './services/like.service';
import { loadProfile } from './services/listener.service';
import { listMoods, moodStation } from './services/mood.service';
import { moodByKey } from './services/moods';
import { getPersonalShelves } from './services/personal.service';
import { getRecap } from './services/recap.service';
import { invalidateCache } from './services/recommendation.service';
import { getTaste, LANGUAGES, saveTaste } from './services/taste.service';

/** Minutes behind UTC, as the browser's `getTimezoneOffset()` gives it (India is -330). */
const tzOffsetOf = (req: Request): number => {
  const value = Number(req.query.tz);
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), -840), 840) : 0;
};

const fail = (res: Response, where: string, error: unknown, message = 'Failed to load') => {
  if (error instanceof UnknownSongError) {
    res.status(404).json({ success: false, error: error.message });
    return;
  }
  console.error(`Error in ${where}:`, error);
  if (!res.headersSent) res.status(500).json({ success: false, error: message });
};

// ─── Likes ────────────────────────────────────────────────────────────────

export const getLikedSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: { songs: await listLikedSongs(req.user!.userid) } });
  } catch (error) {
    fail(res, 'getLikedSongs', error);
  }
};

export const getLikedIds = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: { ids: await likedSongIds(req.user!.userid) } });
  } catch (error) {
    fail(res, 'getLikedIds', error);
  }
};

export const addLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songData } = req.body as { songData?: Record<string, unknown> };
    if (!songData?.id || typeof songData.id !== 'string') {
      res.status(400).json({ success: false, error: 'songData with an id is required' });
      return;
    }
    const userId = req.user!.userid;
    await likeSong(userId, songData);
    // A like changes what's recommended, so the cached lists are rebuilt.
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    fail(res, 'addLike', error, 'Failed to save');
  }
};

export const removeLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    if (!songId || typeof songId !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid songId' });
      return;
    }
    const userId = req.user!.userid;
    await unlikeSong(userId, songId);
    await invalidateCache(userId);
    res.json({ success: true });
  } catch (error) {
    fail(res, 'removeLike', error, 'Failed to save');
  }
};

// ─── Taste ────────────────────────────────────────────────────────────────

export const getMusicTaste = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: { ...(await getTaste(req.user!.userid)), availableLanguages: LANGUAGES },
    });
  } catch (error) {
    fail(res, 'getMusicTaste', error);
  }
};

export const updateMusicTaste = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userid;
    const taste = await saveTaste(userId, (req.body ?? {}) as Record<string, unknown>);
    await invalidateCache(userId);
    res.json({ success: true, data: taste });
  } catch (error) {
    fail(res, 'updateMusicTaste', error, 'Failed to save');
  }
};

// ─── Home ─────────────────────────────────────────────────────────────────

export const getShelves = async (req: Request, res: Response): Promise<void> => {
  try {
    const shelves = await getPersonalShelves(req.user!.userid, {
      tzOffsetMinutes: tzOffsetOf(req),
    });
    res.json({ success: true, data: { shelves } });
  } catch (error) {
    fail(res, 'getShelves', error);
  }
};

export const getMoods = (_req: Request, res: Response): void => {
  res.json({ success: true, data: { moods: listMoods() } });
};

export const getMoodStation = async (req: Request, res: Response): Promise<void> => {
  try {
    const mood = moodByKey(String(req.params.mood));
    if (!mood) {
      res.status(404).json({ success: false, error: 'Unknown mood' });
      return;
    }
    const profile = req.user ? await loadProfile(req.user.userid) : null;
    const songs = await moodStation(mood.key, profile);
    res.json({ success: true, data: { mood: { key: mood.key, title: mood.title }, songs } });
  } catch (error) {
    fail(res, 'getMoodStation', error);
  }
};

// ─── Friends ──────────────────────────────────────────────────────────────

export const getBlendWith = async (req: Request, res: Response): Promise<void> => {
  try {
    const blend = await getBlend(req.user!.userid, Number(req.params.userId));
    res.json({ success: true, data: blend });
  } catch (error) {
    if (error instanceof BlendError) {
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    fail(res, 'getBlendWith', error);
  }
};

export const getFriendsNow = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: { friends: await friendsListeningNow(req.user!.userid) } });
  } catch (error) {
    fail(res, 'getFriendsNow', error);
  }
};

export const getWeeklyRecap = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await getRecap(req.user!.userid, tzOffsetOf(req)) });
  } catch (error) {
    fail(res, 'getWeeklyRecap', error);
  }
};
