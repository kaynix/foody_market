import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSellerSession,
  signInDevelopmentSeller,
  signOutSeller,
} from '../api/auth';
import { SellerAuthProvider, useSellerAuth } from './SellerAuthContext';

vi.mock('../api/auth', () => ({
  fetchSellerSession: vi.fn(),
  signInDevelopmentSeller: vi.fn(),
  signOutSeller: vi.fn(),
}));

const seller = {
  id: 'seller-id',
  status: 'active' as const,
  slug: 'demo-market',
  storeName: 'Demo market',
  onboardingCompleted: false,
};

function SessionProbe() {
  const auth = useSellerAuth();
  if (auth.loading) return <span>loading</span>;
  return (
    <div>
      <span>{auth.seller?.storeName ?? 'anonymous'}</span>
      <button onClick={auth.signOut}>logout</button>
    </div>
  );
}

describe('SellerAuthProvider', () => {
  beforeEach(() => {
    vi.mocked(fetchSellerSession).mockReset();
    vi.mocked(signInDevelopmentSeller).mockReset();
    vi.mocked(signOutSeller).mockReset();
  });

  it('restores an existing server session once on mount', async () => {
    vi.mocked(fetchSellerSession).mockResolvedValue(seller);

    render(<SellerAuthProvider><SessionProbe /></SellerAuthProvider>);

    expect(await screen.findByText('Demo market')).toBeInTheDocument();
    expect(fetchSellerSession).toHaveBeenCalledTimes(1);
  });

  it('clears local seller state after server logout', async () => {
    vi.mocked(fetchSellerSession).mockResolvedValue(seller);
    vi.mocked(signOutSeller).mockResolvedValue();
    const user = userEvent.setup();

    render(<SellerAuthProvider><SessionProbe /></SellerAuthProvider>);
    await screen.findByText('Demo market');
    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
    expect(signOutSeller).toHaveBeenCalledTimes(1);
  });
});
