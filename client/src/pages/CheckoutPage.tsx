import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
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

export default function CheckoutPage() {
  const { t } = useTranslation();
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
  const errorRef = useRef<HTMLDivElement>(null);
  const deliveryNames: Record<CheckoutDeliveryOption['type'], string> = {
    nova_poshta: t('marketplace.deliveryNovaPoshta'),
    pickup: t('marketplace.deliveryPickup'),
    arrangement: t('marketplace.deliveryArrangement'),
  };

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      .catch(() => setError(t('marketplace.cartCheckFailed')));
  }, [lines, t]);

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
          setError(t('marketplace.linkExpired'));
        }
      }).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [channelConfirmed, linkSecret, t]);

  const startChannel = async () => {
    setError(null);
    try {
      setChannelConfirmed(false);
      setIntent(await createBuyerChannelLinkIntent(provider));
    } catch { setError(t('marketplace.linkFailed')); }
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
        ? t('marketplace.cartChanged')
        : t('marketplace.submitFailed'));
    } finally { setSaving(false); }
  };

  if (!cartItems.length) return <div className="checkout-empty"><h1>{t('marketplace.emptyCartTitle')}</h1><Link href="/" className="btn btn-primary">{t('marketplace.toProducts')}</Link></div>;

  return <main className="market-checkout">
    <header><p className="seller-kicker">{t('marketplace.checkoutWithoutPayment')}</p><h1>{t('marketplace.checkoutTitle')}</h1><p>{t('marketplace.checkoutIntro')}</p></header>
    {error ? <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div> : null}
    {validation?.errors.length ? <div className="alert alert-warning" role="alert"><div><strong>{t('marketplace.needsAttention')}</strong>{validation.errors.map((item) => <p key={`${item.code}-${item.productId ?? item.sellerId}`}>{item.message}</p>)}</div></div> : null}
    <form onSubmit={submit} className="market-checkout__layout">
      <div className="market-checkout__route">
        {validation?.groups.map((group, index) => <section className="checkout-seller-stop" key={group.seller.id}>
          <span className="checkout-seller-stop__number">{index + 1}</span>
          <div className="checkout-seller-stop__card"><div className="checkout-seller-stop__heading"><div><small>{t('marketplace.requestForSeller')}</small><h2>{group.seller.storeName}</h2></div><strong>{formatUah(group.subtotalKopecks)}</strong></div>
            <ul>{group.items.map((item) => <li key={item.productId}><span>{item.name} × {item.quantity}</span><strong>{formatUah(item.lineTotalKopecks)}</strong></li>)}</ul>
            <label className="seller-field"><span>{t('marketplace.deliveryMethod')}</span><select value={deliveries[group.seller.id]?.type ?? ''} onChange={(event) => setDeliveries((current) => ({ ...current, [group.seller.id]: { type: event.target.value as CheckoutDeliveryOption['type'], details: current[group.seller.id]?.details ?? '' } }))}>{group.deliveryOptions.map((option) => <option key={option.id} value={option.type}>{deliveryNames[option.type]}</option>)}</select></label>
            <p className="checkout-delivery-note">{group.deliveryOptions.find((option) => option.type === deliveries[group.seller.id]?.type)?.instructions}</p>
            <label className="seller-field"><span>{t('marketplace.deliveryDetails')}</span><input required maxLength={1000} placeholder={deliveries[group.seller.id]?.type === 'nova_poshta' ? t('marketplace.deliveryPlaceholderPost') : t('marketplace.deliveryPlaceholderOther')} value={deliveries[group.seller.id]?.details ?? ''} onChange={(event) => setDeliveries((current) => ({ ...current, [group.seller.id]: { ...current[group.seller.id], details: event.target.value } }))} /></label>
          </div>
        </section>)}
      </div>
      <aside className="market-checkout__buyer"><p className="seller-kicker">{t('marketplace.buyerContact')}</p><h2>{t('marketplace.statusDestination')}</h2><label className="seller-field"><span>{t('marketplace.name')}</span><input required autoComplete="name" minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="seller-field"><span>{t('marketplace.phone')}</span><input required autoComplete="tel" inputMode="tel" pattern="\+?[0-9 ()-]{7,24}" placeholder="+380…" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <div className="checkout-channel"><div><strong>{t('marketplace.messengerRequired')}</strong><p>{t('marketplace.noEmail')}</p></div>{providers.length ? <><select aria-label={t('marketplace.messengerRequired')} value={provider} onChange={(event) => { setProvider(event.target.value); setIntent(null); setChannelConfirmed(false); }}>{providers.map((item) => <option key={item.provider} value={item.provider}>{item.displayName}</option>)}</select><button type="button" className="btn btn-outline w-full" onClick={startChannel}>{intent ? t('marketplace.createNewLink') : t('marketplace.connectMessenger')}</button>{intent ? <a className="btn btn-primary w-full" href={intent.linkUrl} target="_blank" rel="noreferrer">{t('marketplace.openMessenger')}</a> : null}<span role="status" className={`checkout-channel__status ${channelConfirmed ? 'is-confirmed' : ''}`}>{channelConfirmed ? t('marketplace.messengerConfirmed') : t('marketplace.awaitingConfirmation')}</span></> : <div className="alert alert-warning">{t('marketplace.messengerUnavailable')}</div>}</div>
        <button className="btn btn-primary btn-lg w-full" disabled={saving || !validation?.valid || !channelConfirmed}>{saving ? <span className="loading loading-spinner" aria-hidden="true" /> : null}{t('marketplace.createRequests', { count: validation?.groups.length ?? 0 })}</button><p className="checkout-privacy">{t('marketplace.privacy')}</p>
      </aside>
    </form>
  </main>;
}
