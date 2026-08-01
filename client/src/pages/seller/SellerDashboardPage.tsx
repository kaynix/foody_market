import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { useSellerAuth } from '../../contexts/SellerAuthContext';
import { Link } from 'wouter';

function DashboardContent() {
  const { seller } = useSellerAuth();
  return (
    <SellerPortalLayout>
      <main className="seller-workspace">
        <p className="seller-kicker">Кабінет продавця</p>
        <h1>{seller?.storeName}</h1>
        <p className="text-base-content/65">Профіль магазину готовий. Керування товарами та заявками буде додано наступними етапами.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/seller/settings" className="btn btn-primary">Налаштування магазину</Link>
          <Link href="/seller/products" className="btn btn-outline">Керувати товарами</Link>
          <Link href="/seller/channels" className="btn btn-outline">Підключити messenger</Link>
          {seller ? <Link href={`/store/${seller.slug}`} className="btn btn-outline">Переглянути публічну сторінку</Link> : null}
        </div>
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerDashboardPage() {
  return <SellerRoute><DashboardContent /></SellerRoute>;
}
