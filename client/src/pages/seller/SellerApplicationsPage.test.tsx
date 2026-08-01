import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSellerApplications, retrySellerDelivery } from '../../api/applications';
import { useSellerAuth } from '../../contexts/SellerAuthContext';
import SellerApplicationsPage from './SellerApplicationsPage';

vi.mock('../../api/applications', () => ({
  fetchSellerApplications: vi.fn(),
  retrySellerDelivery: vi.fn(),
}));
vi.mock('../../contexts/SellerAuthContext', () => ({ useSellerAuth: vi.fn() }));

describe('SellerApplicationsPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/seller/applications');
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
    vi.mocked(fetchSellerApplications).mockResolvedValue({
      applications: [{
        id: 'application-id',
        status: 'new',
        amountKopecks: 24550,
        checkoutGroupId: 'checkout-group-id',
        itemCount: 2,
        lineCount: 1,
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T12:00:00.000Z',
      }],
      health: {
        channels: [{ provider: 'telegram', active: true, isPrimary: true }],
        failedDeliveries: [{
          id: 'failed-event-id',
          applicationId: 'application-id',
          eventType: 'application.created',
          attemptCount: 5,
          lastError: 'Telegram timeout',
          updatedAt: '2026-08-01T12:00:00.000Z',
        }],
      },
    });
    vi.mocked(retrySellerDelivery).mockResolvedValue({ queued: true });
  });

  it('shows the queue, channel health, and retries a failed delivery', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SellerApplicationsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('2 од. у 1 позиціях')).toBeInTheDocument();
    expect(screen.getByText('● Канал працює')).toBeInTheDocument();
    expect(screen.getByText('1 помилок доставки')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторити' }));

    expect(retrySellerDelivery).toHaveBeenCalled();
    expect(vi.mocked(retrySellerDelivery).mock.calls[0]?.[0]).toBe('failed-event-id');
  });
});
