import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  fetchSellerApplications,
  retrySellerDelivery,
  type ApplicationStatus,
} from '../../api/applications';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { formatUah } from '../../utils/money';

const labels: Record<ApplicationStatus, string> = {
  new: 'Нові', accepted: 'Прийняті', rejected: 'Відхилені',
  cancelled: 'Скасовані', completed: 'Виконані',
};

function ApplicationsContent() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const query = useQuery({
    queryKey: ['seller-applications', status, dateFrom, dateTo],
    queryFn: () => fetchSellerApplications({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });
  const retry = useMutation({
    mutationFn: retrySellerDelivery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-applications'] }),
  });

  return <SellerPortalLayout><main className="seller-workspace seller-workspace--wide seller-applications">
    <header className="seller-applications__heading"><div><p className="seller-kicker">Робоча черга</p><h1>Заявки</h1></div><div className="seller-applications__health"><span className={query.data?.health.channels.some((item) => item.active) ? 'is-ok' : 'is-warning'}>{query.data?.health.channels.some((item) => item.active) ? '● Канал працює' : '● Канал відсутній'}</span><span className={query.data?.health.failedDeliveries.length ? 'is-warning' : 'is-ok'}>{query.data?.health.failedDeliveries.length ?? 0} помилок доставки</span></div></header>
    <section className="seller-application-filters"><label><span>Статус</span><select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}><option value="">Усі</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Від дати</span><input type="datetime-local" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label><span>До дати</span><input type="datetime-local" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></section>
    {query.isLoading ? <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо заявки…</div> : null}
    {query.isError ? <div className="alert alert-error">Не вдалося завантажити заявки.</div> : null}
    {!query.isLoading && query.data?.applications.length === 0 ? <div className="seller-products-empty"><strong>Заявок за цими фільтрами немає</strong><p>Нові заявки з’являться тут одразу після оформлення покупцем.</p></div> : null}
    <div className="seller-application-list">{query.data?.applications.map((application) => <Link href={`/seller/applications/${application.id}`} className={`seller-application-row is-${application.status}`} key={application.id}><span className="seller-application-row__status">{labels[application.status]}</span><div><strong>{application.itemCount} од. у {application.lineCount} позиціях</strong><small>{new Date(application.createdAt).toLocaleString('uk-UA')}</small></div><strong>{formatUah(application.amountKopecks)}</strong><span>Відкрити →</span></Link>)}</div>
    {query.data?.health.failedDeliveries.length ? <section className="seller-delivery-failures"><h2>Не доставлені повідомлення</h2>{query.data.health.failedDeliveries.map((failure) => <div key={failure.id}><div><strong>{failure.eventType}</strong><small>Спроб: {failure.attemptCount} · {failure.lastError ?? 'Невідома помилка'}</small></div><button className="btn btn-sm btn-outline" disabled={retry.isPending} onClick={() => retry.mutate(failure.id)}>Повторити</button></div>)}</section> : null}
  </main></SellerPortalLayout>;
}

export default function SellerApplicationsPage() {
  return <SellerRoute><ApplicationsContent /></SellerRoute>;
}
