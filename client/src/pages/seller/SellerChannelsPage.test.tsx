import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannelLinkIntent, fetchSellerChannels } from '../../api/channels';
import { useSellerAuth } from '../../contexts/SellerAuthContext';
import SellerChannelsPage from './SellerChannelsPage';

vi.mock('../../api/channels', () => ({
  createChannelLinkIntent: vi.fn(),
  disconnectChannel: vi.fn(),
  fetchChannelLinkStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
  fetchSellerChannels: vi.fn(),
  setPrimaryChannel: vi.fn(),
}));
vi.mock('../../contexts/SellerAuthContext', () => ({ useSellerAuth: vi.fn() }));

describe('SellerChannelsPage', () => {
  beforeEach(() => {
    vi.mocked(useSellerAuth).mockReturnValue({
      seller: { id: 'seller', status: 'active', slug: 'store', storeName: 'Крамниця', onboardingCompleted: true },
      loading: false, error: null, signInDevelopment: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn(),
    });
    vi.mocked(fetchSellerChannels).mockResolvedValue({
      providers: [{ provider: 'telegram', displayName: 'Telegram', supportsActions: true, supportsDeepLinks: true }],
      connections: [],
      defaultProvider: 'telegram',
    });
    vi.mocked(createChannelLinkIntent).mockResolvedValue({
      id: 'intent', browserSecret: 'browser-secret', provider: 'telegram',
      linkUrl: 'https://t.me/hutorynok_bot?start=opaque',
      expiresAt: new Date(Date.now() + 60_000).toISOString(), status: 'pending',
    });
  });

  it('marks Telegram as default and exposes the one-time messenger link', async () => {
    const user = userEvent.setup();
    render(<SellerChannelsPage />);

    expect(await screen.findByText('За замовчуванням')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Підключити Telegram' }));

    expect(createChannelLinkIntent).toHaveBeenCalledWith('telegram');
    expect(await screen.findByRole('link', { name: 'Відкрити messenger ↗' })).toHaveAttribute(
      'href', 'https://t.me/hutorynok_bot?start=opaque',
    );
    expect(screen.queryByText('browser-secret')).not.toBeInTheDocument();
  });
});
