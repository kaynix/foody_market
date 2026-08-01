import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  cancelTrackedApplication,
  fetchTracking,
  trackingStorageKey,
  type TrackingGroup,
} from '../api/checkout';
import { formatUah } from '../utils/money';

export default function TrackingPage() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute('/tracking/:groupId');
  const groupId = params?.groupId ?? '';
  const token = sessionStorage.getItem(trackingStorageKey(groupId));
  const [tracking, setTracking] = useState<TrackingGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !token) return;
    fetchTracking(groupId, token)
      .then(setTracking)
      .catch(() => setError(t('marketplace.invalidTracking')));
  }, [groupId, token, t]);

  const cancel = async (applicationId: string) => {
    if (!token || !window.confirm(t('marketplace.cancelConfirm'))) return;
    setBusy(applicationId);
    try {
      await cancelTrackedApplication(groupId, applicationId, token);
      setTracking(await fetchTracking(groupId, token));
    } catch { setError(t('marketplace.cancelUnavailable')); }
    finally { setBusy(null); }
  };

  if (!token) return <div className="tracking-missing"><h1>{t('marketplace.missingTrackingKey')}</h1><p>{t('marketplace.sameBrowser')}</p><Link href="/" className="btn btn-primary">{t('marketplace.homeLink')}</Link></div>;
  if (error && !tracking) return <div className="tracking-missing" role="alert"><h1>{t('marketplace.requestsNotFound')}</h1><p>{error}</p><Link href="/" className="btn btn-primary">{t('marketplace.homeLink')}</Link></div>;
  if (!tracking) return <div className="tracking-missing" role="status"><span className="loading loading-spinner" aria-hidden="true" /> {t('marketplace.loadingStatuses')}</div>;

  return <main className="market-tracking">
    <header><p className="seller-kicker">{t('marketplace.trackingKicker')}</p><h1>{t('marketplace.trackingTitle')}</h1><p>{t('marketplace.trackingIntro', { date: new Date(tracking.createdAt).toLocaleString(i18n.resolvedLanguage === 'de' ? 'de-DE' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'uk-UA') })}</p></header>
    {error ? <div className="alert alert-warning" role="alert">{error}</div> : null}
    <div className="tracking-applications">{tracking.applications.map((application, index) => <article className={`tracking-application is-${application.status}`} key={application.id}>
      <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{t('marketplace.requestForSeller')}</small><Link href={`/store/${application.seller.slug}`}>{application.seller.storeName}</Link></div><strong>{t(`marketplace.status.${application.status}`)}</strong></header>
      <div className="tracking-application__body"><section><h2>{t('marketplace.productsHeading')}</h2><ul>{application.items.map((item) => <li key={item.id}><span>{item.productName} × {item.quantity}</span><strong>{formatUah(item.lineTotalKopecks)}</strong></li>)}</ul><div className="tracking-total"><span>{t('marketplace.totalHeading')}</span><strong>{formatUah(application.amountKopecks)}</strong></div></section>
        <section><h2>{t('marketplace.receiving')}</h2><strong>{t(`marketplace.delivery${application.delivery.type === 'pickup' ? 'Pickup' : application.delivery.type === 'nova_poshta' ? 'NovaPoshta' : 'Arrangement'}`)}</strong><p>{application.delivery.details}</p><small>{application.delivery.instructions}</small></section>
        <section><h2>{t('marketplace.sellerContacts')}</h2>{application.contacts.map((contact) => <p key={contact.id}><span>{contact.label}</span><strong>{contact.value}</strong></p>)}</section>
      </div>
      {application.status === 'new' ? <button className="btn btn-outline btn-sm" disabled={busy === application.id} onClick={() => cancel(application.id)}>{t('marketplace.cancelOne')}</button> : null}
    </article>)}</div>
  </main>;
}
