import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { CartProvider, useCart } from './CartContext';

const product = (id: string, sellerId: string): Product => ({
  id,
  seller: { id: sellerId, slug: `store-${sellerId}`, storeName: `Store ${sellerId}` },
  name: `Product ${id}`, priceKopecks: 1000, categoryId: 1, image: null, images: [],
  description: 'Product', unit: 'piece', minimumQuantity: 1, acceptingApplications: true,
});

function Probe() {
  const { cartItems, addToCart, removeProducts } = useCart();
  return <><output>{cartItems.map((item) => item.productId).join(',')}</output>
    <button onClick={() => addToCart(product('p1', 's1'))}>one</button>
    <button onClick={() => addToCart(product('p2', 's2'))}>two</button>
    <button onClick={() => removeProducts(['p1'])}>accepted</button></>;
}

describe('CartProvider', () => {
  beforeEach(() => localStorage.clear());

  it('persists items and removes only products accepted by checkout', async () => {
    const user = userEvent.setup();
    render(<CartProvider><Probe /></CartProvider>);
    await user.click(screen.getByRole('button', { name: 'one' }));
    await user.click(screen.getByRole('button', { name: 'two' }));
    expect(screen.getByText('p1,p2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'accepted' }));
    expect(screen.getByText('p2')).toBeInTheDocument();
    expect(localStorage.getItem('hutorynok.cart')).toContain('"productId":"p2"');
    expect(localStorage.getItem('hutorynok.cart')).not.toContain('"productId":"p1"');
  });
});
