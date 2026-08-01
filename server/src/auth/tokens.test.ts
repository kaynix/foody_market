import { describe, expect, it } from 'vitest';
import { createOpaqueToken, createSignedToken, safeTokenEqual, verifySignedToken } from './tokens';

describe('auth tokens', () => {
  it('creates unpredictable opaque values', () => {
    expect(createOpaqueToken()).not.toBe(createOpaqueToken());
  });

  it('verifies signed state and rejects tampering', () => {
    const token = createSignedToken('test-secret');

    expect(verifySignedToken(token, 'test-secret')).toBe(true);
    expect(verifySignedToken(`${token}x`, 'test-secret')).toBe(false);
    expect(verifySignedToken(token, 'other-secret')).toBe(false);
  });

  it('rejects an otherwise valid token after its server-side expiry', () => {
    const token = createSignedToken('test-secret', new Date('2026-08-01T10:00:00Z'));

    expect(verifySignedToken(token, 'test-secret', new Date('2026-08-01T09:59:59Z'))).toBe(true);
    expect(verifySignedToken(token, 'test-secret', new Date('2026-08-01T10:00:00Z'))).toBe(false);
  });

  it('compares tokens without accepting length or value changes', () => {
    expect(safeTokenEqual('same', 'same')).toBe(true);
    expect(safeTokenEqual('same', 'different')).toBe(false);
  });
});
