import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FileStorageAdapter, StoredObjectInput } from './types';

export class LocalFileStorageAdapter implements FileStorageAdapter {
  readonly rootDirectory: string;

  constructor(
    rootDirectory: string,
    private readonly publicApiUrl: string,
  ) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async put({ key, data }: StoredObjectInput): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await unlink(target);
    } catch (error) {
      if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getPublicUrl(key: string): string {
    this.resolveKey(key);
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicApiUrl.replace(/\/$/, '')}/uploads/${encodedKey}`;
  }

  private resolveKey(key: string): string {
    if (
      !key ||
      key.includes('\\') ||
      key.startsWith('/') ||
      key.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new Error('Invalid storage key');
    }
    const target = path.resolve(this.rootDirectory, key);
    const relative = path.relative(this.rootDirectory, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Storage key escapes configured root');
    }
    return target;
  }
}
