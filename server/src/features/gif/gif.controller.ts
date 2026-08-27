import type { Request, Response } from 'express';
import { getTrendingGifs, searchGifs } from '@/services/klipy.service';

export const getTrending = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const data = await getTrendingGifs(page, perPage);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to get trending GIFs:', (error as Error).message);
    res.status(500).json({ success: false, message: 'Failed to fetch trending GIFs', data: [] });
  }
};

export const search = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    if (!query.trim()) {
      const data = await getTrendingGifs(page, perPage);
      res.json({ success: true, data });
      return;
    }

    const data = await searchGifs(query, page, perPage);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to search GIFs:', (error as Error).message);
    res.status(500).json({ success: false, message: 'Failed to search GIFs', data: [] });
  }
};
