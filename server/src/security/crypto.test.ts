import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, hashSecret, verifySecretHash } from './crypto';

const key = '1'.repeat(64);

describe('PII encryption', () => {
  it('round-trips plaintext without embedding it in the envelope', () => {
    const encrypted = encryptString('+380501234567', key);

    expect(encrypted).not.toContain('+380501234567');
    expect(decryptString(encrypted, key)).toBe('+380501234567');
  });

  it('uses a fresh IV for each value', () => {
    expect(encryptString('same', key)).not.toBe(encryptString('same', key));
  });

  it('rejects tampered data', () => {
    const encrypted = encryptString('private', key);

    expect(() => decryptString(`${encrypted}broken`, key)).toThrow();
  });
});

describe('secret hashing', () => {
  it('creates deterministic, verifiable hashes without storing the token', () => {
    const hash = hashSecret('tracking-token', 'server-secret');

    expect(hash).not.toContain('tracking-token');
    expect(verifySecretHash('tracking-token', hash, 'server-secret')).toBe(true);
    expect(verifySecretHash('wrong-token', hash, 'server-secret')).toBe(false);
  });
});
