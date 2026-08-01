import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  fetchSellerSession,
  signInDevelopmentSeller,
  signOutSeller,
  type SellerSession,
} from '../api/auth';

interface SellerAuthValue {
  seller: SellerSession | null;
  loading: boolean;
  error: string | null;
  signInDevelopment: (accountId: 'demo-seller' | 'new-seller') => Promise<SellerSession>;
  signOut: () => Promise<void>;
}

const SellerAuthContext = createContext<SellerAuthValue | null>(null);

export function SellerAuthProvider({ children }: { children: ReactNode }) {
  const [seller, setSeller] = useState<SellerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSellerSession()
      .then((session) => {
        if (active) setSeller(session);
      })
      .catch(() => {
        if (active) setError('Не вдалося перевірити сесію. Перевірте з’єднання із сервером.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signInDevelopment = async (accountId: 'demo-seller' | 'new-seller') => {
    setError(null);
    const nextSeller = await signInDevelopmentSeller(accountId);
    setSeller(nextSeller);
    return nextSeller;
  };

  const signOut = async () => {
    await signOutSeller();
    setSeller(null);
  };

  return (
    <SellerAuthContext.Provider value={{ seller, loading, error, signInDevelopment, signOut }}>
      {children}
    </SellerAuthContext.Provider>
  );
}

export function useSellerAuth(): SellerAuthValue {
  const context = useContext(SellerAuthContext);
  if (!context) throw new Error('useSellerAuth must be used inside SellerAuthProvider');
  return context;
}
