import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ProductImageProcessor } from './images';
import type { FileStorageAdapter, StoredObjectInput } from './types';

class MemoryStorage implements FileStorageAdapter {
  readonly objects = new Map<string, Buffer>();
  failAtPut?: number;
  private puts = 0;

  async put(input: StoredObjectInput) {
    this.puts += 1;
    if (this.failAtPut === this.puts) throw new Error('simulated storage failure');
    this.objects.set(input.key, input.data);
  }

  async delete(key: string) {
    this.objects.delete(key);
  }

  getPublicUrl(key: string) {
    return `memory://${key}`;
  }
}

async function jpegWithMetadata() {
  return sharp({
    create: { width: 1200, height: 800, channels: 3, background: '#d69e2e' },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: 'private-camera-owner' } })
    .toBuffer();
}

describe('ProductImageProcessor', () => {
  it('normalizes orientation, creates three WebP variants and strips EXIF', async () => {
    const storage = new MemoryStorage();
    const processor = new ProductImageProcessor(storage);

    const result = await processor.process(
      [{ buffer: await jpegWithMetadata(), mimetype: 'image/jpeg', originalname: 'honey.jpg' }],
      crypto.randomUUID(),
      crypto.randomUUID(),
    );

    expect(result[0].map((image) => image.variant)).toEqual(['thumbnail', 'medium', 'large']);
    expect(storage.objects).toHaveProperty('size', 3);
    for (const data of storage.objects.values()) {
      const metadata = await sharp(data).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
    }
  });

  it('rejects a declared MIME that does not match image content', async () => {
    const storage = new MemoryStorage();
    const processor = new ProductImageProcessor(storage);
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'blue' },
    }).png().toBuffer();

    await expect(
      processor.process(
        [{ buffer: png, mimetype: 'image/jpeg', originalname: 'fake.jpg' }],
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_MIME_MISMATCH' });
    expect(storage.objects.size).toBe(0);
  });

  it('rejects images above the pixel limit', async () => {
    const storage = new MemoryStorage();
    const processor = new ProductImageProcessor(storage);
    const oversized = await sharp({
      create: { width: 5200, height: 5000, channels: 3, background: 'red' },
    }).png().toBuffer();

    await expect(
      processor.process(
        [{ buffer: oversized, mimetype: 'image/png', originalname: 'oversized.png' }],
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(storage.objects.size).toBe(0);
  });

  it('removes only objects uploaded by the failed processing attempt', async () => {
    const storage = new MemoryStorage();
    storage.objects.set('existing/object.webp', Buffer.from('keep'));
    storage.failAtPut = 2;
    const processor = new ProductImageProcessor(storage);
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: 'green' },
    }).png().toBuffer();

    await expect(
      processor.process(
        [{ buffer: png, mimetype: 'image/png', originalname: 'valid.png' }],
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toThrow('simulated storage failure');
    expect([...storage.objects.keys()]).toEqual(['existing/object.webp']);
  });
});
