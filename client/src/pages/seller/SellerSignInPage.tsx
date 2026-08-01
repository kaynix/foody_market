import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { fetchIdentityProviders, type IdentityProviderSummary } from '../../api/auth';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import { useSellerAuth } from '../../contexts/SellerAuthContext';

export default function SellerSignInPage() {
  const [, navigate] = useLocation();
  const { seller, loading: sessionLoading, signInDevelopment } = useSellerAuth();
  const [providers, setProviders] = useState<IdentityProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchIdentityProviders()
      .then((items) => {
        if (active) setProviders(items);
      })
      .catch(() => {
        if (active) setError('Не вдалося завантажити способи входу.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!sessionLoading && seller) {
    return <Redirect to={seller.onboardingCompleted ? '/seller' : '/seller/onboarding'} />;
  }

  const developmentAvailable = providers.some(
    (provider) => provider.name === 'development' && provider.available,
  );
  const diiaAvailable = providers.some(
    (provider) => provider.name === 'diia' && provider.available,
  );

  const handleDevelopmentSignIn = async (accountId: 'demo-seller' | 'new-seller') => {
    setPendingAccount(accountId);
    setError(null);
    try {
      const nextSeller = await signInDevelopment(accountId);
      navigate(nextSeller.onboardingCompleted ? '/seller' : '/seller/onboarding');
    } catch {
      setError('Вхід не виконано. Перевірте, чи запущений локальний API.');
    } finally {
      setPendingAccount(null);
    }
  };

  return (
    <SellerPortalLayout>
      <main className="seller-signin">
        <section className="seller-signin__intro">
          <p className="seller-kicker">Кабінет продавця</p>
          <h1>Ваш прилавок починається з підтвердженого входу.</h1>
          <p>
            Ми не зберігаємо паспортні дані. Зовнішній сервіс підтвердить особу, а
            Хуторинок отримає лише технічний ідентифікатор.
          </p>
          <ol className="seller-route-line" aria-label="Шлях налаштування магазину">
            <li className="is-current"><span>1</span><div><strong>Увійдіть</strong><small>Підтвердження продавця</small></div></li>
            <li><span>2</span><div><strong>Оформіть магазин</strong><small>Контакт і доставка</small></div></li>
            <li><span>3</span><div><strong>Підключіть messenger</strong><small>Telegram за замовчуванням</small></div></li>
          </ol>
        </section>

        <section className="seller-signin__card" aria-labelledby="signin-heading">
          <div className="seller-local-badge">Тільки локальна розробка</div>
          <h2 id="signin-heading">Оберіть тестового продавця</h2>
          <p className="text-base-content/65">
            Ці кнопки не імітують Дію та ніколи не працюватимуть у production.
          </p>

          {error ? <div className="alert alert-error mt-5" role="alert">{error}</div> : null}

          <div className="mt-7 grid gap-3">
            <button
              className="btn btn-primary h-auto justify-between px-5 py-4"
              disabled={loading || !developmentAvailable || pendingAccount !== null}
              onClick={() => handleDevelopmentSignIn('demo-seller')}
            >
              <span className="text-left"><strong className="block">Демо-магазин</strong><small className="font-normal opacity-75">Каталог уже заповнений</small></span>
              {pendingAccount === 'demo-seller' ? <span className="loading loading-spinner" /> : <span aria-hidden="true">→</span>}
            </button>
            <button
              className="btn h-auto justify-between border-base-300 bg-base-100 px-5 py-4"
              disabled={loading || !developmentAvailable || pendingAccount !== null}
              onClick={() => handleDevelopmentSignIn('new-seller')}
            >
              <span className="text-left"><strong className="block">Новий продавець</strong><small className="font-normal opacity-65">Порожній профіль для onboarding</small></span>
              {pendingAccount === 'new-seller' ? <span className="loading loading-spinner" /> : <span aria-hidden="true">→</span>}
            </button>
          </div>

          <div className="seller-diia-row">
            <div><strong>Дія</strong><small>Справжня перевірка особи</small></div>
            <button className="btn btn-sm" disabled={!diiaAvailable}>Ще не підключено</button>
          </div>
        </section>
      </main>
    </SellerPortalLayout>
  );
}
