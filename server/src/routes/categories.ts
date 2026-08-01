import { Router } from 'express';
import type { CatalogService } from '../catalog/catalogService';

export function createCategoryRouter(catalogService: CatalogService): Router {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const data = await catalogService.listCategories();
      response.json({ success: true, data, total: data.length });
    } catch (error) {
      next(error);
    }
  });
  router.get('/slug/:slug', async (request, response, next) => {
    try {
      const data = await catalogService.getCategoryBySlug(request.params.slug);
      response.json({ success: true, data, total: data.products.length });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
