import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hashSecret, verifySecretHash } from '../security/crypto';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createSignedToken(secret: string, expiresAt?: Date): string {
  const payload = `v1.${expiresAt?.getTime() ?? 0}.${createOpaqueToken()}`;
  return `${payload}.${hashSecret(payload, secret)}`;
}

export function verifySignedToken(token: string, secret: string, now = new Date()): boolean {
  const [version, expiryValue, randomValue, signature, ...extra] = token.split('.');
  if (
    version !== 'v1' ||
    !expiryValue ||
    !randomValue ||
    !signature ||
    extra.length > 0
  ) {
    return false;
  }

  const expiry = Number(expiryValue);
  if (!Number.isSafeInteger(expiry) || expiry < 0 || (expiry > 0 && expiry <= now.getTime())) {
    return false;
  }

  return verifySecretHash(`${version}.${expiryValue}.${randomValue}`, signature, secret);
}

export function safeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}
