import path from 'node:path';
import type { AppEnv } from '../config/env';
import { LocalFileStorageAdapter } from './local';
import type { FileStorageAdapter } from './types';

export function createFileStorage(config: AppEnv): FileStorageAdapter {
  if (config.STORAGE_DRIVER === 'local') {
    return new LocalFileStorageAdapter(
      path.resolve(process.cwd(), config.LOCAL_UPLOAD_DIR),
      config.PUBLIC_API_URL,
    );
  }
  throw new Error(`Storage driver ${config.STORAGE_DRIVER} is not implemented`);
}
