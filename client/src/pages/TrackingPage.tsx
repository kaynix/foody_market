import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import {
  cancelTrackedApplication,
  fetchTracking,
  trackingStorageKey,
  type TrackingGroup,
} from '../api/checkout';
import { formatUah } from '../utils/money';

const statusLabels: Record<TrackingGroup['applications'][number]['status'], string> = {
  new: 'Очікує продавця',
  accepted: 'Прийнята',
  rejected: 'Відхилена',
  cancelled: 'Скасована',
  completed: 'Виконана',
};

export default function TrackingPage() {
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
      .catch(() => setError('Посилання відстеження недійсне або більше недоступне.'));
  }, [groupId, token]);

  const cancel = async (applicationId: string) => {
    if (!token || !window.confirm('Скасувати цю заявку? Інші заявки залишаться без змін.')) return;
    setBusy(applicationId);
    try {
      await cancelTrackedApplication(groupId, applicationId, token);
      setTracking(await fetchTracking(groupId, token));
    } catch { setError('Продавець уже змінив статус — скасування недоступне.'); }
    finally { setBusy(null); }
  };

  if (!token) return <div className="tracking-missing"><h1>Немає ключа відстеження</h1><p>Відкрийте сторінку в тому ж браузері, де оформлювали заявки.</p><Link href="/" className="btn btn-primary">На головну</Link></div>;
  if (error && !tracking) return <div className="tracking-missing"><h1>Заявки не знайдено</h1><p>{error}</p><Link href="/" className="btn btn-primary">На головну</Link></div>;
  if (!tracking) return <div className="tracking-missing"><span className="loading loading-spinner" /> Завантажуємо статуси…</div>;

  return <main className="market-tracking">
    <header><p className="seller-kicker">Відстеження заявок</p><h1>Продавці відповідають окремо</h1><p>Оформлено {new Date(tracking.createdAt).toLocaleString('uk-UA')}. Зміна однієї заявки не впливає на інші.</p></header>
    {error ? <div className="alert alert-warning">{error}</div> : null}
    <div className="tracking-applications">{tracking.applications.map((application, index) => <article className={`tracking-application is-${application.status}`} key={application.id}>
      <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>Заявка продавцю</small><Link href={`/store/${application.seller.slug}`}>{application.seller.storeName}</Link></div><strong>{statusLabels[application.status]}</strong></header>
      <div className="tracking-application__body"><section><h2>Товари</h2><ul>{application.items.map((item) => <li key={item.id}><span>{item.productName} × {item.quantity}</span><strong>{formatUah(item.lineTotalKopecks)}</strong></li>)}</ul><div className="tracking-total"><span>Разом</span><strong>{formatUah(application.amountKopecks)}</strong></div></section>
        <section><h2>Отримання</h2><strong>{application.delivery.type === 'pickup' ? 'Самовивіз' : application.delivery.type === 'nova_poshta' ? 'Нова пошта' : 'За домовленістю'}</strong><p>{application.delivery.details}</p><small>{application.delivery.instructions}</small></section>
        <section><h2>Контакти продавця</h2>{application.contacts.map((contact) => <p key={contact.id}><span>{contact.label}</span><strong>{contact.value}</strong></p>)}</section>
      </div>
      {application.status === 'new' ? <button className="btn btn-outline btn-sm" disabled={busy === application.id} onClick={() => cancel(application.id)}>Скасувати лише цю заявку</button> : null}
    </article>)}</div>
  </main>;
}
