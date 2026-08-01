export interface StoredObjectInput {
  key: string;
  data: Buffer;
  contentType: string;
}

export interface FileStorageAdapter {
  put(input: StoredObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
