import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/request';
import type {
  ContactType,
  DeliveryType,
  OnboardingInput,
  SellerSettings,
} from '../../api/sellers';

const stepLabels = ['Магазин', 'Контакт', 'Доставка', 'Messenger'];
const contactLabels: Record<ContactType, string> = {
  phone: 'Телефон',
  telegram: 'Telegram',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  website: 'Сайт',
  other: 'Інший спосіб',
};
const deliveryLabels: Record<DeliveryType, string> = {
  nova_poshta: 'Нова пошта',
  pickup: 'Самовивіз',
  arrangement: 'За домовленістю',
};

const emptyInput: OnboardingInput = {
  profile: { slug: '', storeName: '', description: '', region: '' },
  contacts: [{ type: 'phone', label: 'Телефон', value: '', sortOrder: 0 }],
  deliveryOptions: [
    { type: 'nova_poshta', instructions: 'Вкажіть місто та номер відділення.', active: true },
  ],
};

function fromSettings(settings?: SellerSettings): OnboardingInput {
  if (!settings) return emptyInput;
  return {
    profile: {
      slug: settings.profile.slug.startsWith('seller-') ? '' : settings.profile.slug,
      storeName: settings.profile.storeName === 'Новий магазин' ? '' : settings.profile.storeName,
      description: settings.profile.description,
      region: settings.profile.region,
    },
    contacts: settings.contacts.length ? settings.contacts : emptyInput.contacts,
    deliveryOptions: settings.deliveryOptions.length
      ? settings.deliveryOptions
      : emptyInput.deliveryOptions,
  };
}

export default function SellerProfileEditor({
  initial,
  onSave,
  title = 'Налаштуйте магазин',
}: {
  initial?: SellerSettings;
  onSave: (input: OnboardingInput) => Promise<void>;
  title?: string;
}) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<OnboardingInput>(() => fromSettings(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitStep = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (step < stepLabels.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    setSaving(true);
    try {
      await onSave(input);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.code === 'SLUG_CONFLICT') {
        setError('Ця адреса магазину вже зайнята. Спробуйте іншу.');
      } else if (saveError instanceof ApiError && saveError.code === 'VALIDATION_ERROR') {
        setError('Перевірте контакт, адресу сторінки та інструкцію доставки.');
      } else {
        setError('Не вдалося зберегти профіль. Перевірте з’єднання із сервером.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="seller-editor">
      <aside className="seller-editor__rail" aria-label="Етапи налаштування">
        <p className="seller-kicker">Профіль продавця</p>
        <h1>{title}</h1>
        <ol>
          {stepLabels.map((label, index) => (
            <li key={label} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>
              <button type="button" onClick={() => setStep(index)} disabled={index > step}>
                <span>{index < step ? '✓' : index + 1}</span>{label}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <form className="seller-editor__sheet" onSubmit={submitStep}>
        {step === 0 ? (
          <fieldset>
            <legend>Як покупці впізнають ваш магазин</legend>
            <label className="seller-field">
              <span>Назва магазину</span>
              <input required minLength={2} maxLength={120} value={input.profile.storeName} onChange={(event) => setInput((current) => ({ ...current, profile: { ...current.profile, storeName: event.target.value } }))} placeholder="Наприклад, Сімейна пасіка" />
            </label>
            <label className="seller-field" htmlFor="seller-storefront-slug">
              <span>Адреса сторінки</span>
              <div className="seller-slug-input"><span>/store/</span><input id="seller-storefront-slug" aria-label="Адреса сторінки" required pattern="[A-Za-z0-9_-]{3,64}" value={input.profile.slug} onChange={(event) => setInput((current) => ({ ...current, profile: { ...current.profile, slug: event.target.value } }))} placeholder="family-honey" /></div>
              <small>Латинські літери, цифри, дефіс або нижнє підкреслення.</small>
            </label>
            <label className="seller-field">
              <span>Регіон</span>
              <input maxLength={120} value={input.profile.region} onChange={(event) => setInput((current) => ({ ...current, profile: { ...current.profile, region: event.target.value } }))} placeholder="Полтавська область" />
            </label>
            <label className="seller-field">
              <span>Коротко про магазин</span>
              <textarea maxLength={2000} rows={5} value={input.profile.description} onChange={(event) => setInput((current) => ({ ...current, profile: { ...current.profile, description: event.target.value } }))} placeholder="Що ви виробляєте і чим пишаєтеся" />
            </label>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset>
            <legend>Як покупець зв’яжеться з вами</legend>
            <p className="seller-field-note">Мінімум один контакт завжди буде видимий на сторінці магазину.</p>
            {input.contacts.map((contact, index) => (
              <div className="seller-repeat-row" key={`${contact.type}-${index}`}>
                <label className="seller-field"><span>Тип</span><select value={contact.type} onChange={(event) => setInput((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as ContactType, label: contactLabels[event.target.value as ContactType] } : item) }))}>{Object.entries(contactLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="seller-field"><span>Підпис</span><input required value={contact.label} onChange={(event) => setInput((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label>
                <label className="seller-field seller-repeat-row__value"><span>Контакт</span><input required value={contact.value} onChange={(event) => setInput((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} placeholder={contact.type === 'phone' ? '+380…' : 'https://…'} /></label>
                {input.contacts.length > 1 ? <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setInput((current) => ({ ...current, contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index).map((item, sortOrder) => ({ ...item, sortOrder })) }))}>Видалити</button> : null}
              </div>
            ))}
            {input.contacts.length < 10 ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setInput((current) => ({ ...current, contacts: [...current.contacts, { type: 'phone', label: 'Телефон', value: '', sortOrder: current.contacts.length }] }))}>+ Додати контакт</button> : null}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend>Як ви передаєте покупки</legend>
            <p className="seller-field-note">Інструкція буде показана покупцеві під час оформлення заявки.</p>
            {input.deliveryOptions.map((option, index) => (
              <div className="seller-repeat-row seller-repeat-row--delivery" key={`${option.type}-${index}`}>
                <label className="seller-field"><span>Спосіб</span><select value={option.type} onChange={(event) => setInput((current) => ({ ...current, deliveryOptions: current.deliveryOptions.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as DeliveryType } : item) }))}>{Object.entries(deliveryLabels).map(([value, label]) => <option key={value} value={value} disabled={input.deliveryOptions.some((item, itemIndex) => itemIndex !== index && item.type === value)}>{label}</option>)}</select></label>
                <label className="seller-field seller-repeat-row__value"><span>Інструкція</span><textarea required minLength={3} rows={3} value={option.instructions} onChange={(event) => setInput((current) => ({ ...current, deliveryOptions: current.deliveryOptions.map((item, itemIndex) => itemIndex === index ? { ...item, instructions: event.target.value } : item) }))} /></label>
                {input.deliveryOptions.length > 1 ? <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setInput((current) => ({ ...current, deliveryOptions: current.deliveryOptions.filter((_, itemIndex) => itemIndex !== index) }))}>Видалити</button> : null}
              </div>
            ))}
            {input.deliveryOptions.length < 3 ? <button type="button" className="btn btn-outline btn-sm" onClick={() => { const nextType = (['nova_poshta', 'pickup', 'arrangement'] as DeliveryType[]).find((type) => !input.deliveryOptions.some((item) => item.type === type)); if (nextType) setInput((current) => ({ ...current, deliveryOptions: [...current.deliveryOptions, { type: nextType, instructions: '', active: true }] })); }}>+ Додати спосіб доставки</button> : null}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend>Повідомлення про заявки</legend>
            <div className="seller-messenger-preview">
              <span className="seller-messenger-preview__icon">✈</span>
              <div><strong>Telegram буде каналом за замовчуванням</strong><p>Підключення бота з’явиться на наступному етапі. До підключення каналу товари не прийматимуть нові заявки.</p></div>
              <span className="badge badge-warning">Ще не підключено</span>
            </div>
            <div className="seller-review-grid">
              <div><small>Магазин</small><strong>{input.profile.storeName}</strong><span>/store/{input.profile.slug.toLowerCase().replace(/[\s_]+/g, '-')}</span></div>
              <div><small>Контакти</small><strong>{input.contacts.length}</strong><span>будуть публічними</span></div>
              <div><small>Доставка</small><strong>{input.deliveryOptions.length}</strong><span>активних способів</span></div>
            </div>
          </fieldset>
        ) : null}

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <div className="seller-editor__actions">
          {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep((current) => current - 1)}>Назад</button> : <span />}
          <button className="btn btn-primary" disabled={saving} type="submit">
            {saving ? <span className="loading loading-spinner" /> : null}
            {step === stepLabels.length - 1 ? 'Зберегти профіль' : 'Продовжити'}
          </button>
        </div>
      </form>
    </div>
  );
}
