import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { getTranslatedCategoryName } from '../utils/categoryUtils';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-base-content mb-4">{t('cart')}</h1>
          <div className="bg-base-200 rounded-lg p-8">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-base-content mb-2">{t('emptyCart')}</h2>
            <p className="text-base-content/70 mb-6">{t('emptyCartDescription')}</p>
            <Link href="/">
              <button className="btn btn-primary">{t('continueShopping')}</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="breadcrumbs text-sm mb-6">
        <ul>
          <li><Link href="/" className="text-primary hover:text-primary-focus">{t('home')}</Link></li>
          <li className="text-base-content">{t('cart')}</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-base-content">{t('cart')}</h1>
        <button 
          className="btn btn-outline btn-error"
          onClick={clearCart}
        >
          {t('clearCart')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.product.id} className="card bg-base-100 shadow border border-base-300">
                <div className="card-body">
                  <div className="flex items-center space-x-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 flex-shrink-0">
                      <img 
                        src={item.product.image} 
                        alt={item.product.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = 'http://localhost:3001/images/product-1-s.jpg';
                        }}
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-grow">
                      <Link href={`/product/${item.product.id}`}>
                        <h3 className="font-semibold text-base-content hover:text-primary cursor-pointer">
                          {item.product.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-base-content/60">
                        {getTranslatedCategoryName(item.product.categoryId, t)}
                      </p>
                      <p className="text-lg font-bold text-primary">${item.product.price}</p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2">
                      <button 
                        className="btn btn-sm btn-circle btn-outline"
                        onClick={() => updateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button 
                        className="btn btn-sm btn-circle btn-outline"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-base-content">
                        ₴{(item.product.price * item.quantity).toFixed(2)}
                      </p>
                      <button 
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow border border-base-300 sticky top-4">
            <div className="card-body">
              <h2 className="card-title text-base-content">{t('orderSummary')}</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between text-base-content/70">
                  <span>{t('subtotal')}</span>
                  <span>₴{getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base-content/70">
                  <span>{t('shipping')}</span>
                  <span>{t('freeShipping')}</span>
                </div>
                <div className="flex justify-between text-base-content/70">
                  <span>{t('tax')}</span>
                  <span>₴{(getTotalPrice() * 0.1).toFixed(2)}</span>
                </div>
                <div className="divider"></div>
                <div className="flex justify-between text-lg font-bold text-base-content">
                  <span>{t('total')}</span>
                  <span>₴{(getTotalPrice() * 1.1).toFixed(2)}</span>
                </div>
              </div>

              <div className="card-actions mt-6">
                <button className="btn btn-primary w-full">
                  {t('proceedToCheckout')}
                </button>
                <Link href="/" className="w-full">
                  <button className="btn btn-outline w-full">
                    {t('continueShopping')}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
