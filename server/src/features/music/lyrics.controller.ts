import type { Request, Response } from 'express';
import { createRateLimiter } from '@/utils/rate-limiter';
import { getLyrics, reportWrongLyrics } from './services/lyrics.service';

const SONG_ID = /^[\w-]{1,64}$/;
/** Each report sends a fresh lookup to the lyrics sites. */
const allowReport = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export const getSongLyrics = async (req: Request, res: Response): Promise<void> => {
  const songId = String(req.params.songId ?? '');
  if (!SONG_ID.test(songId)) {
    res.status(400).json({ success: false, error: 'Invalid songId' });
    return;
  }
  try {
    const data = await getLyrics(songId);
    // Lyrics rarely change; let the browser keep them for a while.
    res.set(
      'Cache-Control',
      data.kind === 'none' ? 'private, max-age=3600' : 'private, max-age=86400'
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getSongLyrics:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to load lyrics' });
  }
};

export const reportSongLyrics = async (req: Request, res: Response): Promise<void> => {
  const songId = String(req.params.songId ?? '');
  if (!SONG_ID.test(songId)) {
    res.status(400).json({ success: false, error: 'Invalid songId' });
    return;
  }
  if (!allowReport(req.user!.userid)) {
    res.status(429).json({ success: false, error: 'Too many reports. Try again later.' });
    return;
  }
  try {
    res.json({ success: true, data: await reportWrongLyrics(songId) });
  } catch (error) {
    console.error('Error in reportSongLyrics:', error);
    if (!res.headersSent)
      res.status(500).json({ success: false, error: 'Failed to report lyrics' });
  }
};
