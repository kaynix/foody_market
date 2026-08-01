import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  deleteOwnProduct,
  fetchOwnProducts,
  setOwnProductState,
  type ManagedProduct,
} from '../../api/products';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { formatUah } from '../../utils/money';

function ProductListContent() {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOwnProducts()
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch(() => {
        if (active) setError('Не вдалося завантажити товари.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleState = async (product: ManagedProduct) => {
    const next = await setOwnProductState(
      product.id,
      product.state === 'available' ? 'hidden' : 'available',
    );
    setProducts((items) => items.map((item) => (item.id === next.id ? next : item)));
  };

  const remove = async (product: ManagedProduct) => {
    if (!window.confirm(`Видалити «${product.name}»?`)) return;
    await deleteOwnProduct(product.id);
    setProducts((items) => items.filter((item) => item.id !== product.id));
  };

  return (
    <SellerPortalLayout>
      <main className="seller-workspace seller-workspace--wide">
        <div className="seller-product-heading">
          <div><p className="seller-kicker">Ваш асортимент</p><h1>Товари</h1></div>
          <Link href="/seller/products/new" className="btn btn-primary">+ Додати товар</Link>
        </div>
        {loading ? <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо товари…</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {!loading && !error && products.length === 0 ? <div className="seller-products-empty"><strong>Прилавок поки порожній</strong><p>Додайте перший товар — модерація перед публікацією не потрібна.</p><Link href="/seller/products/new" className="btn btn-primary">Додати товар</Link></div> : null}
        <div className="seller-product-list">{products.map((product) => <article key={product.id} className="seller-product-row">{product.images[0] ? <img src={product.images[0].thumbnailUrl} alt={product.name} /> : <div className="seller-product-row__image">Без фото</div>}<div className="seller-product-row__main"><div className="flex flex-wrap items-center gap-2"><h2>{product.name}</h2><span className={`badge ${product.state === 'available' ? 'badge-success' : 'badge-ghost'}`}>{product.state === 'available' ? 'Видимий' : 'Прихований'}</span>{!product.acceptingApplications ? <span className="badge badge-warning">Без заявок</span> : null}</div><p>{product.description}</p><strong>{formatUah(product.priceKopecks)} / {product.unit}</strong></div><div className="seller-product-row__actions"><Link href={`/seller/products/${product.id}/edit`} className="btn btn-sm btn-outline">Редагувати</Link><button className="btn btn-sm btn-ghost" onClick={() => toggleState(product)}>{product.state === 'available' ? 'Приховати' : 'Показати'}</button><button className="btn btn-sm btn-ghost text-error" onClick={() => remove(product)}>Видалити</button></div></article>)}</div>
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerProductsPage() {
  return <SellerRoute><ProductListContent /></SellerRoute>;
}
