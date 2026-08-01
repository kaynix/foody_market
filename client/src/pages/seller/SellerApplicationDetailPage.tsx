import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { fetchSellerApplication, transitionSellerApplication } from '../../api/applications';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import { formatUah } from '../../utils/money';

function DetailContent() {
  const [, params] = useRoute('/seller/applications/:applicationId');
  const applicationId = params?.applicationId ?? '';
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['seller-application', applicationId],
    queryFn: () => fetchSellerApplication(applicationId),
    enabled: Boolean(applicationId),
  });
  const transition = useMutation({
    mutationFn: (status: 'accepted' | 'rejected' | 'completed') => transitionSellerApplication(applicationId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-application', applicationId] }),
        queryClient.invalidateQueries({ queryKey: ['seller-applications'] }),
      ]);
    },
  });
  const application = query.data;
  if (query.isLoading) return <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо заявку…</div>;
  if (!application || query.isError) return <div className="seller-route-state text-error">Заявку не знайдено.</div>;

  return <SellerPortalLayout><main className="seller-workspace seller-application-detail">
    <Link href="/seller/applications" className="seller-detail-back">← До всіх заявок</Link>
    <header><div><p className="seller-kicker">Заявка покупця</p><h1>{formatUah(application.amountKopecks)}</h1></div><span className={`seller-detail-status is-${application.status}`}>{application.status}</span></header>
    <div className="seller-application-detail__grid"><section><h2>Покупець</h2><p><span>Ім’я</span><strong>{application.buyer.name}</strong></p><p><span>Телефон</span><a href={`tel:${application.buyer.phone}`}>{application.buyer.phone}</a></p></section><section><h2>Отримання</h2><strong>{application.delivery.type === 'pickup' ? 'Самовивіз' : application.delivery.type === 'nova_poshta' ? 'Нова пошта' : 'За домовленістю'}</strong><p>{application.delivery.details}</p><small>{application.delivery.instructions}</small></section></div>
    <section className="seller-application-detail__items"><h2>Товари</h2>{application.items.map((item) => <div key={item.id}><div><strong>{item.productName}</strong><small>{formatUah(item.unitPriceKopecks)} / {item.unit}</small></div><span>× {item.quantity}</span><strong>{formatUah(item.lineTotalKopecks)}</strong></div>)}</section>
    <div className="seller-application-detail__actions">{application.status === 'new' ? <><button className="btn btn-primary" disabled={transition.isPending} onClick={() => transition.mutate('accepted')}>Прийняти заявку</button><button className="btn btn-outline text-error" disabled={transition.isPending} onClick={() => transition.mutate('rejected')}>Відхилити</button></> : null}{application.status === 'accepted' ? <button className="btn btn-primary" disabled={transition.isPending} onClick={() => transition.mutate('completed')}>Позначити виконаною</button> : null}{transition.isError ? <span className="text-error">Статус уже змінився. Оновіть сторінку.</span> : null}</div>
  </main></SellerPortalLayout>;
}

export default function SellerApplicationDetailPage() {
  return <SellerRoute><DetailContent /></SellerRoute>;
}
