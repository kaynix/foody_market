import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBuyerChannelLinkIntent,
  fetchMessagingProviders,
} from '../api/channels';
import { validateCheckout } from '../api/checkout';
import { useCart } from '../contexts/CartContext';
import CheckoutPage from './CheckoutPage';

vi.mock('../api/channels', () => ({
  createBuyerChannelLinkIntent: vi.fn(),
  fetchBuyerChannelLinkStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
  fetchMessagingProviders: vi.fn(),
}));
vi.mock('../api/checkout', () => ({
  createCheckout: vi.fn(),
  trackingStorageKey: (id: string) => `tracking.${id}`,
  validateCheckout: vi.fn(),
}));
vi.mock('../contexts/CartContext', () => ({ useCart: vi.fn() }));

const cartItems = [
  {
    productId: '00000000-0000-4000-8000-000000000001', sellerId: '00000000-0000-4000-8000-000000000011', quantity: 1,
    productSnapshot: { name: 'Мед', priceKopecks: 10000, unit: 'банка', minimumQuantity: 1, image: null, seller: { id: '00000000-0000-4000-8000-000000000011', slug: 'honey', storeName: 'Пасіка' } },
  },
  {
    productId: '00000000-0000-4000-8000-000000000002', sellerId: '00000000-0000-4000-8000-000000000012', quantity: 2,
    productSnapshot: { name: 'Сир', priceKopecks: 5000, unit: 'шт.', minimumQuantity: 1, image: null, seller: { id: '00000000-0000-4000-8000-000000000012', slug: 'cheese', storeName: 'Сироварня' } },
  },
];

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.mocked(useCart).mockReturnValue({
      cartItems, addToCart: vi.fn(), removeFromCart: vi.fn(), updateQuantity: vi.fn(),
      clearCart: vi.fn(), removeProducts: vi.fn(), getTotalItems: vi.fn(), getTotalKopecks: vi.fn(),
    });
    vi.mocked(fetchMessagingProviders).mockResolvedValue({
      providers: [{ provider: 'telegram', displayName: 'Telegram', supportsActions: true, supportsDeepLinks: true }],
      defaultProvider: 'telegram',
    });
    vi.mocked(validateCheckout).mockResolvedValue({
      valid: true,
      errors: [],
      groups: cartItems.map((item, index) => ({
        seller: item.productSnapshot.seller,
        items: [{ productId: item.productId, name: item.productSnapshot.name, unit: item.productSnapshot.unit, priceKopecks: item.productSnapshot.priceKopecks, quantity: item.quantity, lineTotalKopecks: item.productSnapshot.priceKopecks * item.quantity }],
        deliveryOptions: [{ id: `delivery-${index}`, type: 'pickup', instructions: 'Зателефонуйте перед приїздом' }],
        subtotalKopecks: item.productSnapshot.priceKopecks * item.quantity,
      })),
    });
    vi.mocked(createBuyerChannelLinkIntent).mockResolvedValue({
      id: 'intent', browserSecret: 'browser-secret-for-test', provider: 'telegram',
      linkUrl: 'https://t.me/test?start=opaque', expiresAt: new Date(Date.now() + 60_000).toISOString(),
      status: 'pending',
    });
  });

  it('renders one delivery stop per seller and requires messenger confirmation', async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    expect(await screen.findByRole('heading', { name: 'Пасіка' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сироварня' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Створити 2 заявки' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Підключити messenger' }));
    expect(await screen.findByRole('link', { name: 'Відкрити messenger ↗' })).toHaveAttribute(
      'href', 'https://t.me/test?start=opaque',
    );
  });
});
