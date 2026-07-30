import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../contexts/CartContext';
import type { Product } from '../../types';
import { getTranslatedCategoryName } from '../../utils/categoryUtils';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { t } = useTranslation();
  const { addToCart } = useCart();

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow border border-base-300">
      <Link href={`/product/${product.id}`}>
        <figure className="cursor-pointer">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-48 object-cover hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.src = 'http://localhost:3001/images/product-1-m.jpg';
            }}
          />
        </figure>
      </Link>
      <div className="card-body">
        <Link href={`/product/${product.id}`}>
          <h3 className="card-title text-sm text-base-content hover:text-primary cursor-pointer">{product.name}</h3>
        </Link>
        <p className="text-xs text-base-content/60 mb-2">{getTranslatedCategoryName(product.categoryId, t)}</p>
        <p className="text-xs text-base-content/80 line-clamp-2">{product.description}</p>
        <div className="card-actions justify-between items-center mt-4">
          <span className="text-lg font-bold text-primary">₴{product.price}</span>
          <div className="flex space-x-2">
            <Link href={`/product/${product.id}`}>
              <button className="btn btn-sm btn-outline">
                {t('viewDetails')}
              </button>
            </Link>
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => addToCart(product)}
            >
              {t('addToCart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
