import { describe, expect, it } from 'vitest';
import { CART_STORAGE_KEY, readCart, writeCart } from './storage';
import type { CartItem } from '../types';

const item: CartItem = {
  productId: '00000000-0000-4000-8000-000000000001',
  sellerId: '00000000-0000-4000-8000-000000000002',
  quantity: 2,
  productSnapshot: {
    name: 'Мед', priceKopecks: 12500, unit: 'банка', minimumQuantity: 1, image: null,
    seller: {
      id: '00000000-0000-4000-8000-000000000002',
      slug: 'honey-store', storeName: 'Пасіка',
    },
  },
};

describe('versioned cart storage', () => {
  it('round-trips the current minimal snapshot', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    writeCart([item], storage);
    expect(readCart(storage)).toEqual([item]);
    expect(JSON.parse(values.get(CART_STORAGE_KEY)!).version).toBe(1);
  });

  it.each([
    '{broken',
    JSON.stringify({ version: 0, items: [item] }),
    JSON.stringify({ version: 1, items: [{ productId: 1 }] }),
  ])('safely drops incompatible data', (raw) => {
    expect(readCart({ getItem: () => raw })).toEqual([]);
  });
});
