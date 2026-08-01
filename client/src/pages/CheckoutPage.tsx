import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import {
  createBuyerChannelLinkIntent,
  fetchBuyerChannelLinkStatus,
  fetchMessagingProviders,
  type ChannelLinkIntent,
  type ChannelProvider,
} from '../api/channels';
import {
  createCheckout,
  trackingStorageKey,
  validateCheckout,
  type CheckoutDeliveryOption,
  type CheckoutValidation,
} from '../api/checkout';
import { ApiError } from '../api/request';
import { useCart } from '../contexts/CartContext';
import { formatUah } from '../utils/money';

const deliveryNames: Record<CheckoutDeliveryOption['type'], string> = {
  nova_poshta: 'Нова пошта', pickup: 'Самовивіз', arrangement: 'За домовленістю',
};

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const { cartItems, removeProducts } = useCart();
  const lines = useMemo(() => cartItems.map((item) => ({
    productId: item.productId, quantity: item.quantity,
  })), [cartItems]);
  const [validation, setValidation] = useState<CheckoutValidation | null>(null);
  const [providers, setProviders] = useState<ChannelProvider[]>([]);
  const [provider, setProvider] = useState('');
  const [intent, setIntent] = useState<ChannelLinkIntent | null>(null);
  const [channelConfirmed, setChannelConfirmed] = useState(false);
  const [deliveries, setDeliveries] = useState<Record<string, {
    type: CheckoutDeliveryOption['type'];
    details: string;
  }>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lines.length) return;
    Promise.all([validateCheckout(lines), fetchMessagingProviders()])
      .then(([preflight, channelData]) => {
        setValidation(preflight);
        setProviders(channelData.providers);
        setProvider(channelData.defaultProvider ?? channelData.providers[0]?.provider ?? '');
        const initial: Record<string, { type: CheckoutDeliveryOption['type']; details: string }> = {};
        for (const group of preflight.groups) {
          const first = group.deliveryOptions[0];
          if (first) initial[group.seller.id] = { type: first.type, details: '' };
        }
        setDeliveries(initial);
      })
      .catch(() => setError('Не вдалося перевірити корзину. Оновіть сторінку.'));
  }, [lines]);

  const linkSecret = intent?.browserSecret;
  useEffect(() => {
    if (!linkSecret || channelConfirmed) return;
    const timer = window.setInterval(() => {
      fetchBuyerChannelLinkStatus(linkSecret).then((status) => {
        if (status.status === 'confirmed') {
          setChannelConfirmed(true);
          window.clearInterval(timer);
        } else if (status.status === 'expired') {
          setIntent(null);
          window.clearInterval(timer);
          setError('Посилання messenger прострочене. Створіть нове.');
        }
      }).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [channelConfirmed, linkSecret]);

  const startChannel = async () => {
    setError(null);
    try {
      setChannelConfirmed(false);
      setIntent(await createBuyerChannelLinkIntent(provider));
    } catch { setError('Не вдалося створити посилання messenger.'); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation?.valid || !intent || !channelConfirmed) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createCheckout({
        lines: validation.groups.flatMap((group) => group.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          expectedPriceKopecks: item.priceKopecks,
        }))),
        buyer: { name, phone },
        channel: { provider: intent.provider, browserSecret: intent.browserSecret },
        deliveries: validation.groups.map((group) => ({
          sellerId: group.seller.id,
          type: deliveries[group.seller.id].type,
          details: deliveries[group.seller.id].details,
        })),
      });
      sessionStorage.setItem(trackingStorageKey(result.groupId), result.trackingToken);
      removeProducts(result.acceptedProductIds);
      navigate(`/tracking/${result.groupId}`);
    } catch (submitError) {
      setError(submitError instanceof ApiError && submitError.code === 'CHECKOUT_INVALID'
        ? 'Корзина змінилася. Перевірте товари та доставку ще раз.'
        : 'Не вдалося створити заявки. Корзина збережена.');
    } finally { setSaving(false); }
  };

  if (!cartItems.length) return <div className="checkout-empty"><h1>Корзина порожня</h1><Link href="/" className="btn btn-primary">До товарів</Link></div>;

  return <main className="market-checkout">
    <header><p className="seller-kicker">Оформлення без оплати</p><h1>Одна дія — кілька заявок</h1><p>Кожен продавець отримає власну заявку. Статуси прийдуть у вибраний messenger.</p></header>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    {validation?.errors.length ? <div className="alert alert-warning"><div><strong>Деякі позиції потребують уваги</strong>{validation.errors.map((item) => <p key={`${item.code}-${item.productId ?? item.sellerId}`}>{item.message}</p>)}</div></div> : null}
    <form onSubmit={submit} className="market-checkout__layout">
      <div className="market-checkout__route">
        {validation?.groups.map((group, index) => <section className="checkout-seller-stop" key={group.seller.id}>
          <span className="checkout-seller-stop__number">{index + 1}</span>
          <div className="checkout-seller-stop__card"><div className="checkout-seller-stop__heading"><div><small>Заявка продавцю</small><h2>{group.seller.storeName}</h2></div><strong>{formatUah(group.subtotalKopecks)}</strong></div>
            <ul>{group.items.map((item) => <li key={item.productId}><span>{item.name} × {item.quantity}</span><strong>{formatUah(item.lineTotalKopecks)}</strong></li>)}</ul>
            <label className="seller-field"><span>Спосіб отримання</span><select value={deliveries[group.seller.id]?.type ?? ''} onChange={(event) => setDeliveries((current) => ({ ...current, [group.seller.id]: { type: event.target.value as CheckoutDeliveryOption['type'], details: current[group.seller.id]?.details ?? '' } }))}>{group.deliveryOptions.map((option) => <option key={option.id} value={option.type}>{deliveryNames[option.type]}</option>)}</select></label>
            <p className="checkout-delivery-note">{group.deliveryOptions.find((option) => option.type === deliveries[group.seller.id]?.type)?.instructions}</p>
            <label className="seller-field"><span>Деталі доставки</span><input required maxLength={1000} placeholder={deliveries[group.seller.id]?.type === 'nova_poshta' ? 'Місто та номер відділення' : 'Коли і як зручно отримати'} value={deliveries[group.seller.id]?.details ?? ''} onChange={(event) => setDeliveries((current) => ({ ...current, [group.seller.id]: { ...current[group.seller.id], details: event.target.value } }))} /></label>
          </div>
        </section>)}
      </div>
      <aside className="market-checkout__buyer"><p className="seller-kicker">Контакт покупця</p><h2>Куди повідомити статус</h2><label className="seller-field"><span>Ім’я</span><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="seller-field"><span>Телефон</span><input required inputMode="tel" pattern="\+?[0-9 ()-]{7,24}" placeholder="+380…" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <div className="checkout-channel"><div><strong>Messenger обов’язковий</strong><p>Email не потрібен. Підтвердіть, куди надсилати статуси.</p></div>{providers.length ? <><select value={provider} onChange={(event) => { setProvider(event.target.value); setIntent(null); setChannelConfirmed(false); }}>{providers.map((item) => <option key={item.provider} value={item.provider}>{item.displayName}</option>)}</select><button type="button" className="btn btn-outline w-full" onClick={startChannel}>{intent ? 'Створити нове посилання' : 'Підключити messenger'}</button>{intent ? <a className="btn btn-primary w-full" href={intent.linkUrl} target="_blank" rel="noreferrer">Відкрити messenger ↗</a> : null}<span className={`checkout-channel__status ${channelConfirmed ? 'is-confirmed' : ''}`}>{channelConfirmed ? '✓ Messenger підтверджено' : 'Очікуємо підтвердження'}</span></> : <div className="alert alert-warning">Messenger на сервері ще не налаштований.</div>}</div>
        <button className="btn btn-primary btn-lg w-full" disabled={saving || !validation?.valid || !channelConfirmed}>{saving ? <span className="loading loading-spinner" /> : null}Створити {validation?.groups.length ?? 0} заявки</button><p className="checkout-privacy">Натискаючи кнопку, ви надсилаєте продавцям ім’я, телефон і деталі доставки. Паспортні дані не збираються.</p>
      </aside>
    </form>
  </main>;
}
