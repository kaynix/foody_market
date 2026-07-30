import { Router, Request, Response } from 'express';
import { mockProducts } from '../data/mockData';
import type { ApiResponse, Product } from '../types';

const router = Router();

// GET /api/products
// Query params: categoryId, search, minPrice, maxPrice, sortBy
router.get('/', (req: Request, res: Response) => {
  let products = [...mockProducts];

  const { categoryId, search, minPrice, maxPrice, sortBy } = req.query;

  if (categoryId) {
    const id = parseInt(categoryId as string, 10);
    if (!isNaN(id)) {
      products = products.filter((p) => p.categoryId === id);
    }
  }

  if (search) {
    const term = (search as string).toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term),
    );
  }

  if (minPrice) {
    const min = parseFloat(minPrice as string);
    if (!isNaN(min)) {
      products = products.filter((p) => p.price >= min);
    }
  }

  if (maxPrice) {
    const max = parseFloat(maxPrice as string);
    if (!isNaN(max)) {
      products = products.filter((p) => p.price <= max);
    }
  }

  if (sortBy) {
    switch (sortBy) {
      case 'price-asc':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        products.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
  }

  const response: ApiResponse<Product[]> = {
    success: true,
    data: products,
    total: products.length,
  };

  res.json(response);
});

// GET /api/products/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid product ID' });
    return;
  }

  const product = mockProducts.find((p) => p.id === id);

  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  const response: ApiResponse<Product> = {
    success: true,
    data: product,
  };

  res.json(response);
});

export default router;
