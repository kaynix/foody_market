import type { FileStorageAdapter } from '../storage/types';

export function publicImageUrls(
  storageKey: string,
  storage: FileStorageAdapter,
  publicApiUrl: string,
) {
  if (storageKey.startsWith('/images/')) {
    const mediumUrl = `${publicApiUrl.replace(/\/$/, '')}${storageKey}`;
    return { thumbnailUrl: mediumUrl, mediumUrl, largeUrl: mediumUrl };
  }

  return {
    thumbnailUrl: storage.getPublicUrl(storageKey.replace(/-medium\.webp$/, '-thumbnail.webp')),
    mediumUrl: storage.getPublicUrl(storageKey),
    largeUrl: storage.getPublicUrl(storageKey.replace(/-medium\.webp$/, '-large.webp')),
  };
}
