import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { API_BASE_URL } from '../api/request';
import { fetchStorefront, type PublicStorefront } from '../api/sellers';

function contactHref(type: string, value: string): string | undefined {
  if (type === 'phone' && !value.startsWith('tel:')) return `tel:${value.replace(/[ ()-]/g, '')}`;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : undefined;
}

export default function StorefrontPage() {
  const [, params] = useRoute('/store/:slug');
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    let active = true;
    fetchStorefront(params.slug)
      .then((value) => {
        if (active) setStorefront(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [params?.slug]);

  if (error) return <div className="storefront-state"><h1>Магазин не знайдено</h1><p>Перевірте адресу або поверніться до каталогу.</p></div>;
  if (!storefront) return <div className="storefront-state"><span className="loading loading-spinner" /> Завантажуємо магазин…</div>;

  return (
    <div className="public-storefront">
      <section className="public-storefront__hero">
        <p className="seller-kicker">Продавець на Хуторинку</p>
        <h1>{storefront.store.storeName}</h1>
        <p>{storefront.store.description || 'Продавець ще не додав опис магазину.'}</p>
        {storefront.store.region ? <span className="public-storefront__region">⌖ {storefront.store.region}</span> : null}
      </section>

      <section className="public-storefront__facts" aria-label="Контакти та доставка">
        <div><h2>Зв’язатися з продавцем</h2><ul>{storefront.contacts.map((contact) => { const href = contactHref(contact.type, contact.value); return <li key={contact.id}><span>{contact.label}</span>{href ? <a href={href}>{contact.value}</a> : <strong>{contact.value}</strong>}</li>; })}</ul></div>
        <div><h2>Доставка</h2><ul>{storefront.deliveryOptions.map((option) => <li key={option.id}><strong>{option.type === 'nova_poshta' ? 'Нова пошта' : option.type === 'pickup' ? 'Самовивіз' : 'За домовленістю'}</strong><span>{option.instructions}</span></li>)}</ul></div>
      </section>

      <section className="public-storefront__products">
        <div className="public-storefront__section-heading"><p className="seller-kicker">Вітрина</p><h2>Товари продавця</h2><span>{storefront.products.length}</span></div>
        {storefront.products.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{storefront.products.map((product) => { const image = product.images[0]; const imageUrl = image?.storageKey.startsWith('/') ? `${API_BASE_URL}${image.storageKey}` : image?.storageKey; return <article className="public-storefront__product" key={product.id}>{imageUrl ? <img src={imageUrl} alt={image?.altText || product.name} /> : <div className="public-storefront__image-placeholder">Фото готується</div>}<div><h3>{product.name}</h3><p>{product.description}</p><strong>{(product.priceKopecks / 100).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' })}</strong></div></article>; })}</div> : <div className="public-storefront__empty">Продавець ще не опублікував товари.</div>}
      </section>
    </div>
  );
}
