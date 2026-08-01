import { describe, expect, it } from 'vitest';
import { contactInputSchema, onboardingInputSchema, slugSchema } from './validation';

describe('seller profile validation', () => {
  it('normalizes a safe storefront slug', () => {
    expect(slugSchema.parse('  My_Farm  ')).toBe('my-farm');
  });

  it('rejects unsafe or mismatched contact URLs', () => {
    expect(
      contactInputSchema.safeParse({
        type: 'website',
        label: 'Website',
        value: 'http://unsafe.example',
      }).success,
    ).toBe(false);
    expect(
      contactInputSchema.safeParse({
        type: 'telegram',
        label: 'Telegram',
        value: 'https://evil.example/user',
      }).success,
    ).toBe(false);
    expect(
      contactInputSchema.safeParse({
        type: 'telegram',
        label: 'Telegram',
        value: 'https://t.me/farmer',
      }).success,
    ).toBe(true);
  });

  it('requires a public contact and an active delivery option for onboarding', () => {
    const result = onboardingInputSchema.safeParse({
      profile: { slug: 'farm-shop', storeName: 'Farm shop' },
      contacts: [],
      deliveryOptions: [
        { type: 'pickup', instructions: 'Call before arrival', active: false },
      ],
    });

    expect(result.success).toBe(false);
  });
});
