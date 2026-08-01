import type { CartItem } from '../types';

export const CART_STORAGE_KEY = 'hutorynok.cart';
export const CART_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCartItem(value: unknown): value is CartItem {
  if (!isRecord(value) || !isRecord(value.productSnapshot)) return false;
  const snapshot = value.productSnapshot;
  if (!isRecord(snapshot.seller)) return false;
  const seller = snapshot.seller;
  return typeof value.productId === 'string'
    && typeof value.sellerId === 'string'
    && Number.isInteger(value.quantity) && Number(value.quantity) > 0
    && typeof snapshot.name === 'string'
    && Number.isInteger(snapshot.priceKopecks) && Number(snapshot.priceKopecks) >= 0
    && typeof snapshot.unit === 'string'
    && Number.isInteger(snapshot.minimumQuantity) && Number(snapshot.minimumQuantity) > 0
    && (typeof snapshot.image === 'string' || snapshot.image === null)
    && typeof seller.id === 'string'
    && typeof seller.slug === 'string'
    && typeof seller.storeName === 'string'
    && value.sellerId === seller.id;
}

export function readCart(storage: Pick<Storage, 'getItem'> = localStorage): CartItem[] {
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== CART_STORAGE_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.every(isCartItem) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[], storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: CART_STORAGE_VERSION, items }));
}
