import { Router, Request, Response } from 'express';
import { mockBannerAds } from '../data/mockData';
import type { ApiResponse, BannerAd } from '../types';

const router = Router();

// GET /api/banners
router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<BannerAd[]> = {
    success: true,
    data: mockBannerAds,
    total: mockBannerAds.length,
  };
  res.json(response);
});

// GET /api/banners/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid banner ID' });
    return;
  }

  const banner = mockBannerAds.find((b) => b.id === id);

  if (!banner) {
    res.status(404).json({ success: false, message: 'Banner not found' });
    return;
  }

  const response: ApiResponse<BannerAd> = {
    success: true,
    data: banner,
  };

  res.json(response);
});

export default router;
