import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStorefront } from '../api/sellers';
import StorefrontPage from './StorefrontPage';

vi.mock('../api/sellers', () => ({ fetchStorefront: vi.fn() }));

describe('StorefrontPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/store/family-honey');
    vi.mocked(fetchStorefront).mockResolvedValue({
      store: {
        id: 'seller-id',
        slug: 'family-honey',
        storeName: 'Сімейна пасіка',
        description: 'Мед від виробника',
        region: 'Полтавська область',
      },
      contacts: [
        { id: 'contact-id', type: 'phone', label: 'Телефон', value: '+380501234567' },
      ],
      deliveryOptions: [
        { id: 'delivery-id', type: 'pickup', instructions: 'Зателефонуйте заздалегідь' },
      ],
      products: [],
    });
  });

  it('shows the seller public contact and delivery without private account data', async () => {
    render(<StorefrontPage />);

    expect(await screen.findByRole('heading', { name: 'Сімейна пасіка' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+380501234567' })).toHaveAttribute(
      'href',
      'tel:+380501234567',
    );
    expect(screen.getByText('Зателефонуйте заздалегідь')).toBeInTheDocument();
    expect(screen.queryByText(/identityProvider/i)).not.toBeInTheDocument();
  });
});
