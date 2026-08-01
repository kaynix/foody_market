import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, Product } from '../types';
import { readCart, writeCart } from '../cart/storage';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  removeProducts: (productIds: string[]) => void;
  getTotalItems: () => number;
  getTotalKopecks: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readCart());

  useEffect(() => writeCart(cartItems), [cartItems]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (!product.acceptingApplications) return;
    const addedQuantity = Math.max(quantity, product.minimumQuantity);
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === product.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + addedQuantity }
            : item
        );
      } else {
        return [...prevItems, {
          productId: product.id,
          sellerId: product.seller.id,
          quantity: addedQuantity,
          productSnapshot: {
            name: product.name,
            priceKopecks: product.priceKopecks,
            unit: product.unit,
            minimumQuantity: product.minimumQuantity,
            image: product.image,
            seller: product.seller,
          },
        }];
      }
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prevItems => prevItems.map(item => item.productId === productId
      ? { ...item, quantity: Math.max(quantity, item.productSnapshot.minimumQuantity) }
      : item));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const removeProducts = useCallback((productIds: string[]) => {
    const accepted = new Set(productIds);
    setCartItems((items) => items.filter((item) => !accepted.has(item.productId)));
  }, []);

  const getTotalItems = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const getTotalKopecks = useCallback(() => {
    return cartItems.reduce((total, item) => total + (item.productSnapshot.priceKopecks * item.quantity), 0);
  }, [cartItems]);

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    removeProducts,
    getTotalItems,
    getTotalKopecks,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
