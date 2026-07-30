import { useEffect, useState } from 'react';
import BannerCarousel from '../components/ui/BannerCarousel';
import ProductGrid from '../components/ui/ProductGrid';
import { useProductFilter } from '../hooks/useProductFilter';
import { useTranslation } from 'react-i18next';
import { fetchProducts, fetchBanners } from '../api/client';
import type { Product, BannerAd } from '../types';

function HomePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchBanners()])
      .then(([productsRes, bannersData]) => {
        setProducts(productsRes.data);
        setBanners(bannersData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const {
    searchTerm,
    selectedCategory,
    filteredProducts,
  } = useProductFilter(products);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <>
      <BannerCarousel bannerAds={banners} />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-base-content">{t('featuredProducts')}</h2>
          <p className="text-base-content/70">
            {filteredProducts.length} {t('productsFound')}
            {searchTerm && ` ${t('for')} "${searchTerm}"`}
            {selectedCategory !== 'all' && ` ${t('in')} ${selectedCategory}`}
          </p>
        </div>

        <ProductGrid 
          products={filteredProducts}
        />
      </div>
    </>
  );
}

export default HomePage;
