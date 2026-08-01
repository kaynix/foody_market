import { useEffect, useState } from 'react';
import { fetchSellerSettings, saveSellerOnboarding, type SellerSettings } from '../../api/sellers';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerProfileEditor from '../../components/seller/SellerProfileEditor';
import SellerRoute from '../../components/seller/SellerRoute';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

function SettingsContent() {
  const { refreshSession } = useSellerAuth();
  const [settings, setSettings] = useState<SellerSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSellerSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  if (!settings) return <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо налаштування…</div>;

  return (
    <SellerPortalLayout>
      <main className="seller-workspace seller-workspace--wide">
        {saved ? <div className="alert alert-success mb-6">Профіль збережено.</div> : null}
        <SellerProfileEditor
          initial={settings}
          title="Налаштування магазину"
          onSave={async (input) => {
            const next = await saveSellerOnboarding(input);
            setSettings(next);
            setSaved(true);
            await refreshSession();
          }}
        />
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerSettingsPage() {
  return <SellerRoute requireOnboarding={false}><SettingsContent /></SellerRoute>;
}
