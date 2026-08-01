import { describe, expect, it } from 'vitest';
import { redactText } from './redaction';

describe('redactText', () => {
  it('removes credentials and phone-like identifiers', () => {
    const result = redactText('Bearer abc.def token=secret-value phone +380 67 123 45 67');

    expect(result).not.toContain('abc.def');
    expect(result).not.toContain('secret-value');
    expect(result).not.toContain('380 67 123');
  });
});
