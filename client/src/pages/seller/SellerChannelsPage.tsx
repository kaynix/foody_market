import { useCallback, useEffect, useState } from 'react';
import {
  createChannelLinkIntent,
  disconnectChannel,
  fetchChannelLinkStatus,
  fetchSellerChannels,
  setPrimaryChannel,
  type ChannelLinkIntent,
  type SellerChannels,
} from '../../api/channels';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';

function ChannelContent() {
  const [data, setData] = useState<SellerChannels | null>(null);
  const [intent, setIntent] = useState<ChannelLinkIntent | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setData(await fetchSellerChannels()), []);

  useEffect(() => {
    load().catch(() => setError('Не вдалося завантажити канали.'));
  }, [load]);

  const linkSecret = intent?.browserSecret;
  useEffect(() => {
    if (!linkSecret) return;
    const timer = window.setInterval(() => {
      fetchChannelLinkStatus(linkSecret)
        .then(async (status) => {
          if (status.status === 'confirmed') {
            window.clearInterval(timer);
            setIntent(null);
            await load();
          } else if (status.status === 'expired') {
            window.clearInterval(timer);
            setIntent(null);
            setError('Час підключення минув. Створіть нове посилання.');
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [linkSecret, load]);

  const connect = async (provider: string) => {
    setBusyProvider(provider);
    setError(null);
    try {
      setIntent(await createChannelLinkIntent(provider));
    } catch {
      setError('Не вдалося створити посилання для підключення.');
    } finally {
      setBusyProvider(null);
    }
  };

  const makePrimary = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const result = await setPrimaryChannel(provider);
      setData((current) => current ? { ...current, connections: result.connections } : current);
    } catch {
      setError('Не вдалося змінити основний канал.');
    } finally { setBusyProvider(null); }
  };

  const disconnect = async (provider: string) => {
    if (!window.confirm('Відключити канал? Товари без інших каналів перестануть приймати заявки.')) return;
    setBusyProvider(provider);
    try {
      await disconnectChannel(provider);
      await load();
    } catch {
      setError('Не вдалося відключити канал.');
    } finally { setBusyProvider(null); }
  };

  return (
    <SellerPortalLayout>
      <main className="seller-workspace seller-workspace--wide seller-channels">
        <header className="seller-channels__heading">
          <div><p className="seller-kicker">Сповіщення і дії</p><h1>Канали зв’язку</h1></div>
          <p>Покупці бачать ваш магазин завжди. Нові заявки надходять лише коли активний хоча б один канал.</p>
        </header>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {!data ? <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо канали…</div> : null}
        {data && data.providers.length === 0 ? <section className="seller-channel-empty"><span>↗</span><div><h2>Жоден messenger ще не налаштований</h2><p>Для локального запуску додайте Telegram bot token та username у конфігурацію сервера.</p></div></section> : null}

        <div className="seller-channel-grid">
          {data?.providers.map((provider) => {
            const connection = data.connections.find((item) => item.provider === provider.provider);
            const active = Boolean(connection?.active);
            return <article className={`seller-channel-card ${active ? 'is-connected' : ''}`} key={provider.provider}>
              <div className="seller-channel-card__wire" aria-hidden="true"><span>↗</span><i /></div>
              <div><p className="seller-kicker">{provider.provider === data.defaultProvider ? 'За замовчуванням' : 'Доступний канал'}</p><h2>{provider.displayName}</h2><p>{active ? 'Канал підключено. Нові заявки та зміни статусів можуть надходити сюди.' : 'Підключення відкриється в messenger і підтвердиться автоматично.'}</p></div>
              <div className="seller-channel-card__actions">
                {active ? <><span className="badge badge-success">Підключено</span>{connection?.isPrimary ? <span className="badge badge-outline">Основний</span> : <button className="btn btn-sm btn-outline" disabled={busyProvider === provider.provider} onClick={() => makePrimary(provider.provider)}>Зробити основним</button>}<button className="btn btn-sm btn-ghost text-error" disabled={busyProvider === provider.provider} onClick={() => disconnect(provider.provider)}>Відключити</button></> : <button className="btn btn-primary" disabled={busyProvider === provider.provider} onClick={() => connect(provider.provider)}>{busyProvider === provider.provider ? <span className="loading loading-spinner" /> : null}Підключити {provider.displayName}</button>}
              </div>
            </article>;
          })}
        </div>

        {intent ? <section className="seller-channel-intent" role="status"><div><span className="seller-channel-intent__pulse" /><div><strong>Підтвердіть підключення в {data?.providers.find((item) => item.provider === intent.provider)?.displayName}</strong><p>Посилання одноразове й діє до {new Date(intent.expiresAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}.</p></div></div><a className="btn btn-primary" href={intent.linkUrl} target="_blank" rel="noreferrer">Відкрити messenger ↗</a></section> : null}
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerChannelsPage() {
  return <SellerRoute><ChannelContent /></SellerRoute>;
}
