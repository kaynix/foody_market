import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

export default function SellerRoute({
  children,
  requireOnboarding = true,
}: {
  children: ReactNode;
  requireOnboarding?: boolean;
}) {
  const { seller, loading, error } = useSellerAuth();

  if (loading) {
    return (
      <div className="seller-route-state" role="status">
        <span className="loading loading-spinner loading-md" />
        <span>Перевіряємо сесію продавця…</span>
      </div>
    );
  }
  if (error) return <div className="seller-route-state text-error">{error}</div>;
  if (!seller) return <Redirect to="/seller/sign-in" />;
  if (requireOnboarding && !seller.onboardingCompleted) {
    return <Redirect to="/seller/onboarding" />;
  }
  return children;
}
