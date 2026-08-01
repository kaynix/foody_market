import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { fetchSellerSettings, saveSellerOnboarding, type SellerSettings } from '../../api/sellers';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerProfileEditor from '../../components/seller/SellerProfileEditor';
import SellerRoute from '../../components/seller/SellerRoute';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

function OnboardingContent() {
  const [, navigate] = useLocation();
  const { refreshSession } = useSellerAuth();
  const [settings, setSettings] = useState<SellerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSellerSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setError('Не вдалося завантажити профіль продавця.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <div className="seller-route-state text-error">{error}</div>;
  if (!settings) return <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо профіль…</div>;

  return (
    <SellerPortalLayout>
      <main className="seller-workspace seller-workspace--wide">
        <SellerProfileEditor
          initial={settings}
          onSave={async (input) => {
            await saveSellerOnboarding(input);
            await refreshSession();
            navigate('/seller');
          }}
        />
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerOnboardingPage() {
  return <SellerRoute requireOnboarding={false}><OnboardingContent /></SellerRoute>;
}
