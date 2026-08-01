import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalFileStorageAdapter } from './local';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('LocalFileStorageAdapter contract', () => {
  it('stores, resolves and deletes an opaque key below its configured root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hutorynok-storage-'));
    temporaryDirectories.push(root);
    const storage = new LocalFileStorageAdapter(root, 'http://localhost:3001/');

    await storage.put({ key: 'products/seller/image.webp', data: Buffer.from('image'), contentType: 'image/webp' });
    expect(await readFile(path.join(root, 'products/seller/image.webp'), 'utf8')).toBe('image');
    expect(storage.getPublicUrl('products/seller/image.webp')).toBe(
      'http://localhost:3001/uploads/products/seller/image.webp',
    );

    await storage.delete('products/seller/image.webp');
    await expect(readFile(path.join(root, 'products/seller/image.webp'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['../escape.webp', '/absolute.webp', 'products\\escape.webp', 'products//image.webp'])(
    'rejects traversal or ambiguous key %s',
    async (key) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'hutorynok-storage-'));
      temporaryDirectories.push(root);
      const storage = new LocalFileStorageAdapter(root, 'http://localhost:3001');

      await expect(storage.put({ key, data: Buffer.from('x'), contentType: 'image/webp' })).rejects.toThrow(
        'Invalid storage key',
      );
    },
  );
});
