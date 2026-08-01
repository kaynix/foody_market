import { Router } from 'express';
import { z } from 'zod';
import type { CatalogService } from '../catalog/catalogService';
import { productIdSchema } from '../catalog/validation';
import { AppHttpError } from '../http/errors';

const querySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(160).optional(),
  minPriceKopecks: z.coerce.number().int().min(0).optional(),
  maxPriceKopecks: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['price-asc', 'price-desc', 'name-asc', 'name-desc']).optional(),
});

export function createProductRouter(catalogService: CatalogService): Router {
  const router = Router();
  router.get('/', async (request, response, next) => {
    try {
      const query = querySchema.safeParse(request.query);
      if (!query.success) throw new AppHttpError('Invalid catalog filters', 400, 'VALIDATION_ERROR');
      const data = await catalogService.listProducts(query.data);
      response.json({ success: true, data, total: data.length });
    } catch (error) {
      next(error);
    }
  });
  router.get('/:id', async (request, response, next) => {
    try {
      const id = productIdSchema.safeParse(request.params.id);
      if (!id.success) throw new AppHttpError('Invalid product ID', 400, 'VALIDATION_ERROR');
      response.json({ success: true, data: await catalogService.getProduct(id.data) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
