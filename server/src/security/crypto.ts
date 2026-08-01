import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ENCRYPTION_VERSION = 'v1';
const IV_BYTES = 12;

function parseEncryptionKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('PII encryption key must contain exactly 32 bytes');
  }
  return key;
}

export function encryptString(plaintext: string, keyHex: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', parseEncryptionKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptString(envelope: string, keyHex: string): string {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = envelope.split('.');
  if (
    version !== ENCRYPTION_VERSION ||
    !ivValue ||
    !tagValue ||
    ciphertextValue === undefined ||
    extra.length > 0
  ) {
    throw new Error('Unsupported or malformed encrypted value');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    parseEncryptionKey(keyHex),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function hashSecret(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function verifySecretHash(value: string, expectedHash: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;

  const actual = Buffer.from(hashSecret(value, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
