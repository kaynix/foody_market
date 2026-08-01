import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchIdentityProviders,
  fetchSellerSession,
  signInDevelopmentSeller,
} from '../../api/auth';
import { SellerAuthProvider } from '../../contexts/SellerAuthContext';
import SellerSignInPage from './SellerSignInPage';

vi.mock('../../api/auth', () => ({
  fetchIdentityProviders: vi.fn(),
  fetchSellerSession: vi.fn(),
  signInDevelopmentSeller: vi.fn(),
  signOutSeller: vi.fn(),
}));

describe('SellerSignInPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/seller/sign-in');
    vi.mocked(fetchSellerSession).mockResolvedValue(null);
    vi.mocked(fetchIdentityProviders).mockResolvedValue([
      { name: 'development', displayName: 'Local', available: true },
      { name: 'diia', displayName: 'Дія', available: false },
    ]);
    vi.mocked(signInDevelopmentSeller).mockResolvedValue({
      id: 'new-id',
      status: 'active',
      slug: 'new-seller',
      storeName: 'Новий магазин',
      onboardingCompleted: false,
    });
  });

  it('marks local login clearly and sends a new seller to onboarding', async () => {
    const user = userEvent.setup();
    render(<SellerAuthProvider><SellerSignInPage /></SellerAuthProvider>);

    expect(await screen.findByText('Тільки локальна розробка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ще не підключено/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Новий продавець/ }));

    expect(signInDevelopmentSeller).toHaveBeenCalledWith('new-seller');
    expect(window.location.pathname).toBe('/seller/onboarding');
  });
});
