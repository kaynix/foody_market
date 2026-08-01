import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SellerProfileEditor from './SellerProfileEditor';

describe('SellerProfileEditor', () => {
  it('collects profile, public contact and delivery before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SellerProfileEditor onSave={onSave} />);

    await user.type(screen.getByLabelText('Назва магазину'), 'Сімейна пасіка');
    await user.type(screen.getByLabelText('Адреса сторінки'), 'family_honey');
    await user.type(screen.getByLabelText('Регіон'), 'Полтавська область');
    await user.type(screen.getByLabelText('Коротко про магазин'), 'Мед від виробника');
    await user.click(screen.getByRole('button', { name: 'Продовжити' }));

    await user.type(screen.getByLabelText('Контакт'), '+380501234567');
    await user.click(screen.getByRole('button', { name: 'Продовжити' }));
    expect(screen.getByDisplayValue('Вкажіть місто та номер відділення.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Продовжити' }));

    expect(screen.getByText('Telegram буде каналом за замовчуванням')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Зберегти профіль' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ slug: 'family_honey', storeName: 'Сімейна пасіка' }),
        contacts: [expect.objectContaining({ type: 'phone', value: '+380501234567' })],
        deliveryOptions: [expect.objectContaining({ type: 'nova_poshta', active: true })],
      }),
    );
  });
});
