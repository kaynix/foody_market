import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

export default function SellerPortalLayout({ children }: { children: ReactNode }) {
  const { seller, signOut } = useSellerAuth();

  return (
    <div className="seller-portal min-h-screen">
      <header className="seller-portal__header">
        <Link href="/" className="seller-portal__brand" aria-label="Хуторинок — головна">
          <span className="seller-portal__brand-mark">Х</span>
          <span>Хуторинок</span>
        </Link>
        {seller ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">{seller.storeName}</span>
            <Link href="/seller" className="btn btn-sm border-white/20 bg-white/10 text-white">
              Кабінет
            </Link>
            <Link href="/seller/settings" className="hidden text-sm text-white/75 hover:text-white md:inline">
              Налаштування
            </Link>
            <Link href="/seller/products" className="hidden text-sm text-white/75 hover:text-white md:inline">
              Товари
            </Link>
            <Link href="/seller/channels" className="hidden text-sm text-white/75 hover:text-white md:inline">
              Канали
            </Link>
            <button className="btn btn-sm border-white/20 bg-white/10 text-white" onClick={signOut}>
              Вийти
            </button>
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
