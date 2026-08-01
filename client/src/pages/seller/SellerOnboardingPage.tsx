import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

function OnboardingContent() {
  const { seller } = useSellerAuth();
  return (
    <SellerPortalLayout>
      <main className="seller-workspace">
        <p className="seller-kicker">Крок 2 із 3</p>
        <h1>Вхід працює. Далі — профіль магазину.</h1>
        <p className="max-w-2xl text-lg text-base-content/65">
          Ви увійшли як <strong>{seller?.storeName}</strong>. Редактор профілю, обов’язковий
          публічний контакт і способи доставки з’являться на наступному етапі.
        </p>
        <div className="seller-next-card">
          <span>Наступний етап</span>
          <strong>Магазин → контакт покупців → доставка</strong>
        </div>
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerOnboardingPage() {
  return <SellerRoute requireOnboarding={false}><OnboardingContent /></SellerRoute>;
}
