import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { fetchProduct } from '../api/client';
import EmptyImagePlaceholder from '../components/ui/EmptyImagePlaceholder';
import Toast from '../components/ui/Toast';
import { useCart } from '../contexts/CartContext';
import type { Product } from '../types';
import { getTranslatedCategoryName } from '../utils/categoryUtils';
import { formatUah } from '../utils/money';

export default function ProductDetailPage() {
  const [, params] = useRoute('/product/:id');
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    let active = true;
    setLoading(true);
    fetchProduct(params.id)
      .then((value) => {
        if (active) {
          setProduct(value);
          setQuantity(value.minimumQuantity);
        }
      })
      .catch(() => {
        if (active) setProduct(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params?.id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  if (!product) return <div className="container mx-auto px-4 py-12 text-center"><h1 className="text-2xl font-bold">{t('productNotFound')}</h1><p>{t('productNotFoundDesc')}</p></div>;

  const image = product.images[selectedImage];
  const canApply = product.acceptingApplications;
  const minimum = product.minimumQuantity;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="breadcrumbs mb-6 text-sm"><ul><li><Link href="/">{t('home')}</Link></li><li>{getTranslatedCategoryName(product.categoryId, t)}</li><li>{product.name}</li></ul></div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <section>
            <div className="aspect-square overflow-hidden rounded-2xl bg-base-200">
              {image ? <img src={image.largeUrl} alt={image.altText || product.name} className="h-full w-full object-cover" /> : <EmptyImagePlaceholder className="h-full w-full" title="Фото ще немає" />}
            </div>
            {product.images.length > 1 ? <div className="mt-3 flex gap-3">{product.images.map((item, index) => <button key={item.id} className={`h-20 w-20 overflow-hidden rounded-lg border-2 ${selectedImage === index ? 'border-primary' : 'border-base-300'}`} onClick={() => setSelectedImage(index)}><img src={item.thumbnailUrl} alt={item.altText || `${product.name} ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div> : null}
          </section>

          <section className="space-y-6">
            <div><p className="seller-kicker">{getTranslatedCategoryName(product.categoryId, t)}</p><h1 className="text-4xl font-extrabold tracking-tight text-base-content">{product.name}</h1><Link href={`/store/${product.seller.slug}`} className="mt-3 inline-flex font-semibold text-primary hover:underline">{product.seller.storeName} →</Link></div>
            <p className="whitespace-pre-line text-lg leading-relaxed text-base-content/75">{product.description}</p>
            <div className="text-4xl font-extrabold text-primary">{formatUah(product.priceKopecks)} <small className="text-base font-medium text-base-content/55">/ {product.unit}</small></div>

            {!canApply ? <div className="alert alert-warning"><span>Продавець ще не підключив канал повідомлень. Товар видно, але нові заявки тимчасово не приймаються.</span></div> : null}
            <div className="flex items-center gap-3"><span>{t('quantity')}:</span><button className="btn btn-sm btn-outline" onClick={() => setQuantity((value) => Math.max(minimum, value - 1))}>−</button><strong className="w-10 text-center">{quantity}</strong><button className="btn btn-sm btn-outline" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
            <button className="btn btn-primary btn-lg w-full" disabled={!canApply} onClick={() => { addToCart(product, quantity); setToast(t('addedToCart', { quantity, name: product.name })); }}>{canApply ? `${t('addToCart')} — ${formatUah(product.priceKopecks * quantity)}` : 'Заявки призупинено'}</button>
            <button className="btn btn-ghost btn-sm text-base-content/60" onClick={() => setToast(t('complaintComingSoon'))}>⚑ {t('reportProduct')}</button>
          </section>
        </div>
      </div>
      {toast ? <Toast message={toast} type="info" show onClose={() => setToast(null)} /> : null}
    </>
  );
}
