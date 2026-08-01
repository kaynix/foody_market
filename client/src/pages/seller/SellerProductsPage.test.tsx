import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOwnProducts, setOwnProductState } from '../../api/products';
import { useSellerAuth } from '../../contexts/SellerAuthContext';
import SellerProductsPage from './SellerProductsPage';

vi.mock('../../api/products', () => ({
  deleteOwnProduct: vi.fn(),
  fetchOwnProducts: vi.fn(),
  setOwnProductState: vi.fn(),
}));
vi.mock('../../contexts/SellerAuthContext', () => ({ useSellerAuth: vi.fn() }));

const product = {
  id: '16d43149-91f5-4b5d-bddd-d483144cc5c7',
  categoryId: 1,
  name: 'Липовий мед',
  description: 'З власної пасіки',
  priceKopecks: 24550,
  unit: 'банка',
  minimumQuantity: 1,
  state: 'available' as const,
  acceptingApplications: false,
  images: [{
    id: '2cd43149-91f5-4b5d-bddd-d483144cc5c7',
    altText: 'Липовий мед',
    sortOrder: 0,
    thumbnailUrl: '/uploads/honey-thumbnail.webp',
    mediumUrl: '/uploads/honey-medium.webp',
    largeUrl: '/uploads/honey-large.webp',
  }],
};

describe('SellerProductsPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/seller/products');
    vi.mocked(useSellerAuth).mockReturnValue({
      seller: {
        id: 'seller-id',
        status: 'active',
        slug: 'family-honey',
        storeName: 'Сімейна пасіка',
        onboardingCompleted: true,
      },
      loading: false,
      error: null,
      signInDevelopment: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    });
    vi.mocked(fetchOwnProducts).mockResolvedValue([product]);
    vi.mocked(setOwnProductState).mockResolvedValue({ ...product, state: 'hidden' });
  });

  it('shows immediate publication status and can hide a product', async () => {
    const user = userEvent.setup();
    render(<SellerProductsPage />);

    expect(await screen.findByRole('heading', { name: 'Липовий мед' })).toBeInTheDocument();
    expect(screen.getByText('245,50 ₴ / банка')).toBeInTheDocument();
    expect(screen.getByText('Без заявок')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Приховати' }));

    expect(setOwnProductState).toHaveBeenCalledWith(product.id, 'hidden');
    expect(await screen.findByText('Прихований')).toBeInTheDocument();
  });
});
