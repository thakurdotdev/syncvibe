import { Router, type Request, type Response } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth.middleware';
import { requireAdmin } from '@/middleware/admin.middleware';
import {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylists,
  getPlaylistSongs,
} from './music.controller';
import {
  addToHistory,
  getPersonalizedRecommendations,
  getHistorySongs,
} from './history.controller';
import { recordPlayEvents } from './play-events.controller';
import {
  addArtistDislike,
  addDislike,
  getDislikedArtists,
  getDislikedSongs,
  removeArtistDislike,
  removeDislike,
} from './dislike.controller';
import {
  addLike,
  getBlendWith,
  getFriendsNow,
  getLikedIds,
  getLikedSongs,
  getMoods,
  getMoodStation,
  getMusicTaste,
  getShelves,
  getWeeklyRecap,
  removeLike,
  updateMusicTaste,
} from './personal.controller';
import type { Steer } from './services/play-next.personal';
import { moodByKey } from './services/moods';
import { searchSongs } from './search.controller';
import { getSongLyrics, reportSongLyrics } from './lyrics.controller';
import { getLastSessionSongs } from './group-history.controller';
import {
  syncModulesData,
  syncArtistCatalogs,
  syncArtistDeepCatalog,
  syncSearchQueries,
  syncFeaturedPlaylists,
  syncTopAlbums,
  syncByPlaylistIds,
  syncByAlbumIds,
  syncFull,
  getSyncStats,
  getLastSyncResult,
  POPULAR_ARTISTS,
  SEARCH_QUERIES,
} from './services/music-sync.service';
import { getPlayNextSongs, rebuildAllPlayNext } from './services/play-next.service';

export const musicRouter: Router = Router();

// Filling and rebuilding the catalog is heavy and writes to what everyone hears: the owner only.
musicRouter.use(['/sync', '/play-next/rebuild'], authMiddleware, requireAdmin);

// Playlists
musicRouter.post('/playlist/create', authMiddleware, createPlaylist);
musicRouter.post('/playlist', authMiddleware, createPlaylist);

musicRouter.patch('/playlist/update', authMiddleware, updatePlaylist);
musicRouter.put('/playlist/update', authMiddleware, updatePlaylist);
musicRouter.patch('/playlist', authMiddleware, updatePlaylist);
musicRouter.put('/playlist', authMiddleware, updatePlaylist);

musicRouter.delete('/playlist/delete', authMiddleware, deletePlaylist);
musicRouter.delete('/playlist', authMiddleware, deletePlaylist);

musicRouter.post('/playlist/add-song', authMiddleware, addSongToPlaylist);
musicRouter.post('/playlist/remove-song', authMiddleware, removeSongFromPlaylist);

musicRouter.get('/playlist/get', authMiddleware, getPlaylists);
musicRouter.get('/playlists', authMiddleware, getPlaylists);
musicRouter.get('/playlist', authMiddleware, getPlaylists);

musicRouter.get('/playlist/details', authMiddleware, getPlaylistSongs);
musicRouter.get('/playlist/songs', authMiddleware, getPlaylistSongs);

// History & Discovery
musicRouter.post('/history/add', authMiddleware, addToHistory);
musicRouter.post('/music/history/add', authMiddleware, addToHistory);
musicRouter.post('/play-events', authMiddleware, recordPlayEvents);

// Songs a listener never wants recommended again
musicRouter.get('/music/dislikes', authMiddleware, getDislikedSongs);
musicRouter.post('/music/dislikes', authMiddleware, addDislike);
musicRouter.delete('/music/dislikes/:songId', authMiddleware, removeDislike);
// Artists a listener never wants recommended
musicRouter.get('/music/dislikes-artists', authMiddleware, getDislikedArtists);
musicRouter.post('/music/dislikes-artists', authMiddleware, addArtistDislike);
musicRouter.delete('/music/dislikes-artists/:artistId', authMiddleware, removeArtistDislike);

// Songs a listener liked
musicRouter.get('/music/likes', authMiddleware, getLikedSongs);
musicRouter.get('/music/likes/ids', authMiddleware, getLikedIds);
musicRouter.post('/music/likes', authMiddleware, addLike);
musicRouter.delete('/music/likes/:songId', authMiddleware, removeLike);

// Languages and artists a listener chose, and whether friends see what they play
musicRouter.get('/music/taste', authMiddleware, getMusicTaste);
musicRouter.put('/music/taste', authMiddleware, updateMusicTaste);

// Personal home: Daily Mixes, time of day, new releases, rediscover, liked
musicRouter.get('/music/shelves', authMiddleware, getShelves);
musicRouter.get('/music/moods', getMoods);
musicRouter.get('/music/moods/:mood', optionalAuthMiddleware, getMoodStation);
musicRouter.get('/music/blend/:userId', authMiddleware, getBlendWith);
musicRouter.get('/music/friends/now', authMiddleware, getFriendsNow);
musicRouter.get('/music/recap', authMiddleware, getWeeklyRecap);

// Lyrics: timed when we can find them
musicRouter.get('/music/lyrics/:songId', getSongLyrics);
musicRouter.post('/music/lyrics/:songId/report', authMiddleware, reportSongLyrics);

musicRouter.get('/music/recommendations', authMiddleware, getPersonalizedRecommendations);
musicRouter.get('/music/latestHistory', authMiddleware, getHistorySongs);
musicRouter.get('/music/history', authMiddleware, getHistorySongs);
musicRouter.get('/music/search', searchSongs);
musicRouter.get('/music/group-history', authMiddleware, getLastSessionSongs);

// Sync Endpoints
musicRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const { languages = ['hindi'], bypassCache = false } = req.body as {
      languages?: string[];
      bypassCache?: boolean;
    };
    const stats = await syncModulesData(languages, bypassCache);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/artists', async (req: Request, res: Response) => {
  try {
    const { artistIds, limit } = req.body as { artistIds?: string[]; limit?: number };
    const stats = await syncArtistCatalogs(artistIds ?? null, limit || 50);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Artist sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/artist-deep', async (req: Request, res: Response) => {
  try {
    const { artistId, pages } = req.body as { artistId?: string; pages?: number };
    if (!artistId) {
      res.status(400).json({ success: false, error: 'artistId is required' });
      return;
    }
    const stats = await syncArtistDeepCatalog(artistId, pages || 3);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Deep artist sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/search', async (req: Request, res: Response) => {
  try {
    const { queries, limit } = req.body as { queries?: string[]; limit?: number };
    const stats = await syncSearchQueries(queries ?? null, limit || 5);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Search sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/featured', async (req: Request, res: Response) => {
  try {
    const { languages, limit } = req.body as { languages?: string[]; limit?: number };
    const stats = await syncFeaturedPlaylists(languages || ['hindi'], limit || 5);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Featured sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/top-albums', async (req: Request, res: Response) => {
  try {
    const { languages, limit } = req.body as { languages?: string[]; limit?: number };
    const stats = await syncTopAlbums(languages || ['hindi'], limit || 5);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Top albums sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/playlists', async (req: Request, res: Response) => {
  try {
    const { playlistIds, bypassCache = false } = req.body as {
      playlistIds?: string[];
      bypassCache?: boolean;
    };
    if (!playlistIds?.length) {
      res.status(400).json({ success: false, error: 'playlistIds array is required' });
      return;
    }
    const stats = await syncByPlaylistIds(playlistIds, bypassCache);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Playlist sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/albums', async (req: Request, res: Response) => {
  try {
    const { albumIds, bypassCache = false } = req.body as {
      albumIds?: string[];
      bypassCache?: boolean;
    };
    if (!albumIds?.length) {
      res.status(400).json({ success: false, error: 'albumIds array is required' });
      return;
    }
    const stats = await syncByAlbumIds(albumIds, bypassCache);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Album sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.post('/sync/full', async (req: Request, res: Response) => {
  try {
    const { languages } = req.body as { languages?: string[] };
    const stats = await syncFull({ languages: languages || ['hindi'] });
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Full sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.get('/sync/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getSyncStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[MusicSync] Stats failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

musicRouter.get('/sync/status', (_req: Request, res: Response) => {
  try {
    const lastResult = getLastSyncResult();
    res.json({
      success: true,
      data: {
        lastSync: lastResult,
        availableArtists: POPULAR_ARTISTS,
        availableQueries: SEARCH_QUERIES,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Play Next
/** Session signals beyond this many are old news for steering. */
const MAX_SESSION_SIGNALS = 30;

const idList = (value: unknown): string[] =>
  typeof value === 'string' && value
    ? value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

const steerOf = (value: unknown): Steer | null => {
  if (value === 'more' || value === 'different') return value;
  if (typeof value === 'string' && value.startsWith('mood:')) {
    const mood = moodByKey(value.slice('mood:'.length));
    return mood ? `mood:${mood.key}` : null;
  }
  return null;
};

musicRouter.get(
  '/play-next/:songId',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      if (!songId || typeof songId !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid songId' });
        return;
      }
      const limitRaw = parseInt(req.query.limit as string, 10);
      const limit = Math.min(Math.max(limitRaw || 20, 1), 50);
      const excludeSongIds = idList(req.query.exclude);
      const data = await getPlayNextSongs({
        baseSongId: songId,
        userId: req.user?.userid ?? null,
        limit,
        excludeSongIds,
        skippedSongIds: idList(req.query.skipped).slice(0, MAX_SESSION_SIGNALS),
        finishedSongIds: idList(req.query.finished).slice(0, MAX_SESSION_SIGNALS),
        steer: steerOf(req.query.steer),
      });
      res.json({ success: true, data });
    } catch (error) {
      console.error('[PlayNext] Error:', (error as Error).message);
      if (res.headersSent) return;
      const status = (error as Error).message.includes('not found') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: status === 404 ? 'Song not found' : 'Failed to load songs',
      });
    }
  }
);

musicRouter.post('/play-next/rebuild', async (_req: Request, res: Response) => {
  try {
    const stats = await rebuildAllPlayNext();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[PlayNext] Rebuild failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
