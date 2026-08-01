import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireCsrf, requireSeller } from '../auth/middleware';
import type { SellerSessionService } from '../auth/sessionService';
import type { AppEnv } from '../config/env';
import { AppHttpError } from '../http/errors';
import { IMAGE_LIMITS } from '../storage/images';
import type { SellerProductService } from './sellerProductService';
import { imageOrderInputSchema, productIdSchema, productInputSchema, productStateInputSchema } from './validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: IMAGE_LIMITS.maxFiles, fileSize: IMAGE_LIMITS.maxBytesPerFile },
}).array('images', IMAGE_LIMITS.maxFiles);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppHttpError(z.prettifyError(result.error), 400, 'VALIDATION_ERROR');
  return result.data;
}

function uploadImages(
  request: Parameters<typeof upload>[0],
  response: Parameters<typeof upload>[1],
  next: Parameters<typeof upload>[2],
) {
  upload(request, response, (error) => {
    if (error) {
      next(new AppHttpError('Image upload exceeds configured limits', 400, 'IMAGE_UPLOAD_LIMIT'));
      return;
    }
    next();
  });
}

export function createSellerProductRouter(
  config: AppEnv,
  sessionService: SellerSessionService,
  productService: SellerProductService,
): Router {
  const router = Router();
  router.use(requireSeller(sessionService));

  router.get('/', async (request, response, next) => {
    try {
      response.json({ products: await productService.listOwn(request.seller!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/',
    requireCsrf(config.SESSION_SECRET),
    uploadImages,
    async (request, response, next) => {
      try {
        const input = parse(productInputSchema, request.body);
        const files = (request.files ?? []) as Express.Multer.File[];
        response.status(201).json({
          product: await productService.create(request.seller!.id, input, files),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put('/:productId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const productId = parse(productIdSchema, request.params.productId);
      const input = parse(productInputSchema, request.body);
      response.json({ product: await productService.update(request.seller!.id, productId, input) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:productId/state', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const productId = parse(productIdSchema, request.params.productId);
      const { state } = parse(productStateInputSchema, request.body);
      response.json({ product: await productService.setState(request.seller!.id, productId, state) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:productId/image-order', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const productId = parse(productIdSchema, request.params.productId);
      const { imageIds } = parse(imageOrderInputSchema, request.body);
      response.json({ product: await productService.reorderImages(request.seller!.id, productId, imageIds) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:productId', requireCsrf(config.SESSION_SECRET), async (request, response, next) => {
    try {
      const productId = parse(productIdSchema, request.params.productId);
      await productService.delete(request.seller!.id, productId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
