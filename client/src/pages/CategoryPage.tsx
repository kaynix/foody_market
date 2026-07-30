import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import ProductGrid from '../components/ui/ProductGrid';
import { fetchCategoryBySlug } from '../api/client';
import { getTranslatedCategoryName } from '../utils/categoryUtils';
import type { Category, Product } from '../types';

const CategoryPage: React.FC = () => {
  const [, params] = useRoute('/category/:slug');
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    setNotFound(false);
    fetchCategoryBySlug(params.slug)
      .then(({ category: cat, products }) => {
        setCategory(cat);
        setCategoryProducts(products);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params?.slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-base-content mb-4">{t('productNotFound')}</h1>
          <p className="text-base-content/70">{t('productNotFoundDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="breadcrumbs text-sm mb-6">
        <ul>
          <li><a href="/" className="text-primary hover:text-primary-focus">{t('home')}</a></li>
          <li><a href="/" className="text-primary hover:text-primary-focus">{t('products')}</a></li>
          <li className="text-base-content">{getTranslatedCategoryName(category.id, t)}</li>
        </ul>
      </div>

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-2">
          {getTranslatedCategoryName(category.id, t)}
        </h1>
        <p className="text-base-content/70">
          {categoryProducts.length} {t('productsFound')} {t('in')} {getTranslatedCategoryName(category.id, t)}
        </p>
      </div>

      {/* Products Grid */}
      {categoryProducts.length > 0 ? (
        <ProductGrid 
          products={categoryProducts}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-base-content/70 text-lg">
            No products found in this category.
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
