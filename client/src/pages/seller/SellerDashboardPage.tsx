import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

function DashboardContent() {
  const { seller } = useSellerAuth();
  return (
    <SellerPortalLayout>
      <main className="seller-workspace">
        <p className="seller-kicker">Кабінет продавця</p>
        <h1>{seller?.storeName}</h1>
        <p className="text-base-content/65">Керування товарами та заявками буде додано наступними етапами.</p>
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerDashboardPage() {
  return <SellerRoute><DashboardContent /></SellerRoute>;
}
