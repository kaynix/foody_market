import { useMemo } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { formatUah } from '../utils/money';

export default function CartPage() {
  const { t } = useTranslation();
  const { cartItems, removeFromCart, updateQuantity, getTotalKopecks, clearCart } = useCart();
  const groups = useMemo(() => {
    const bySeller = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const current = bySeller.get(item.sellerId) ?? [];
      current.push(item);
      bySeller.set(item.sellerId, current);
    }
    return [...bySeller.values()];
  }, [cartItems]);

  if (cartItems.length === 0) return <div className="cart-empty"><span>К</span><h1>{t('emptyCart')}</h1><p>{t('emptyCartDescription')}</p><Link href="/" className="btn btn-primary">{t('continueShopping')}</Link></div>;

  return <main className="market-cart">
    <header className="market-cart__heading"><div><p className="seller-kicker">Одна корзина · окремі заявки</p><h1>{t('cart')}</h1></div><button className="btn btn-ghost text-error" onClick={clearCart}>{t('clearCart')}</button></header>
    <div className="market-cart__layout">
      <section className="market-cart__groups">
        {groups.map((items, index) => {
          const seller = items[0].productSnapshot.seller;
          const subtotal = items.reduce((sum, item) => sum + item.productSnapshot.priceKopecks * item.quantity, 0);
          return <article className="market-cart__seller" key={seller.id}>
            <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>Окрема заявка продавцю</small><Link href={`/store/${seller.slug}`}>{seller.storeName}</Link></div><strong>{formatUah(subtotal)}</strong></header>
            {items.map((item) => <div className="market-cart__item" key={item.productId}>
              {item.productSnapshot.image ? <img src={item.productSnapshot.image} alt={item.productSnapshot.name} /> : <div className="market-cart__placeholder">Фото</div>}
              <div><Link href={`/product/${item.productId}`}><h2>{item.productSnapshot.name}</h2></Link><p>{formatUah(item.productSnapshot.priceKopecks)} / {item.productSnapshot.unit}</p></div>
              <div className="market-cart__quantity"><button aria-label="Зменшити кількість" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>−</button><strong>{item.quantity}</strong><button aria-label="Збільшити кількість" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>＋</button></div>
              <strong>{formatUah(item.productSnapshot.priceKopecks * item.quantity)}</strong>
              <button className="market-cart__remove" onClick={() => removeFromCart(item.productId)}>{t('remove')}</button>
            </div>)}
          </article>;
        })}
      </section>
      <aside className="market-cart__summary"><p className="seller-kicker">Підсумок</p><h2>{groups.length} {groups.length === 1 ? 'заявка' : 'заявки'}</h2><div><span>Товари</span><strong>{formatUah(getTotalKopecks())}</strong></div><p>Доставка узгоджується окремо з кожним продавцем. Податків та прихованих доплат немає.</p><Link href="/checkout" className="btn btn-primary w-full">Оформити заявки</Link><Link href="/" className="btn btn-outline w-full">{t('continueShopping')}</Link></aside>
    </div>
  </main>;
}
