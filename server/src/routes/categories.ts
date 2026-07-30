import { Router, Request, Response } from 'express';
import { categories, mockProducts } from '../data/mockData';
import type { ApiResponse, Category } from '../types';

const router = Router();

// GET /api/categories
router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<Category[]> = {
    success: true,
    data: categories,
    total: categories.length,
  };
  res.json(response);
});

// GET /api/categories/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid category ID' });
    return;
  }

  const category = categories.find((c) => c.id === id);

  if (!category) {
    res.status(404).json({ success: false, message: 'Category not found' });
    return;
  }

  const response: ApiResponse<Category> = {
    success: true,
    data: category,
  };

  res.json(response);
});

// GET /api/categories/slug/:slug
router.get('/slug/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    res.status(404).json({ success: false, message: 'Category not found' });
    return;
  }

  const products = mockProducts.filter((p) => p.categoryId === category.id);

  res.json({
    success: true,
    data: { category, products },
    total: products.length,
  });
});

export default router;
