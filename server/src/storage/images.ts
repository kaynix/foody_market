import { randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { AppHttpError } from '../http/errors';
import type { FileStorageAdapter } from './types';

export const IMAGE_LIMITS = {
  maxFiles: 5,
  maxBytesPerFile: 8 * 1024 * 1024,
  maxPixels: 25_000_000,
} as const;

const formatMime = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

const variants = [
  { name: 'thumbnail', width: 320, quality: 78 },
  { name: 'medium', width: 960, quality: 82 },
  { name: 'large', width: 1600, quality: 84 },
] as const;

export interface IncomingImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface ProcessedProductImage {
  storageKey: string;
  variant: (typeof variants)[number]['name'];
  width: number;
}

export class ProductImageProcessor {
  constructor(private readonly storage: FileStorageAdapter) {}

  async process(
    files: IncomingImage[],
    sellerId: string,
    productId: string,
  ): Promise<ProcessedProductImage[][]> {
    if (files.length < 1 || files.length > IMAGE_LIMITS.maxFiles) {
      throw new AppHttpError('A product requires 1 to 5 images', 400, 'IMAGE_COUNT_INVALID');
    }

    const uploadedKeys: string[] = [];
    try {
      const result: ProcessedProductImage[][] = [];
      for (const file of files) {
        if (file.buffer.byteLength > IMAGE_LIMITS.maxBytesPerFile) {
          throw new AppHttpError('Image file is too large', 400, 'IMAGE_TOO_LARGE');
        }
        const source = sharp(file.buffer, { limitInputPixels: IMAGE_LIMITS.maxPixels });
        let metadata: Metadata;
        try {
          metadata = await source.metadata();
        } catch {
          throw new AppHttpError('Image content is invalid', 400, 'IMAGE_CONTENT_INVALID');
        }
        const detectedMime = metadata.format ? formatMime.get(metadata.format) : undefined;
        if (!detectedMime || detectedMime !== file.mimetype) {
          throw new AppHttpError(
            'Declared image type does not match its content',
            400,
            'IMAGE_MIME_MISMATCH',
          );
        }
        if (!metadata.width || !metadata.height || metadata.width * metadata.height > IMAGE_LIMITS.maxPixels) {
          throw new AppHttpError('Image dimensions are too large', 400, 'IMAGE_PIXELS_EXCEEDED');
        }
        if ((metadata.pages ?? 1) > 1) {
          throw new AppHttpError('Animated images are not supported', 400, 'ANIMATED_IMAGE_UNSUPPORTED');
        }

        const imageId = randomUUID();
        const processed: ProcessedProductImage[] = [];
        for (const variant of variants) {
          const data = await sharp(file.buffer, { limitInputPixels: IMAGE_LIMITS.maxPixels })
            .rotate()
            .resize({ width: variant.width, withoutEnlargement: true })
            .webp({ quality: variant.quality })
            .toBuffer();
          const key = `products/${sellerId}/${productId}/${imageId}-${variant.name}.webp`;
          await this.storage.put({ key, data, contentType: 'image/webp' });
          uploadedKeys.push(key);
          processed.push({ storageKey: key, variant: variant.name, width: variant.width });
        }
        result.push(processed);
      }
      return result;
    } catch (error) {
      await Promise.allSettled(uploadedKeys.map((key) => this.storage.delete(key)));
      throw error;
    }
  }

  async cleanup(processed: ProcessedProductImage[][]): Promise<void> {
    await Promise.allSettled(
      processed.flat().map((image) => this.storage.delete(image.storageKey)),
    );
  }
}
