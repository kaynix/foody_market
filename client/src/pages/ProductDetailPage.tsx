import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { fetchProduct } from '../api/client';
import { getTranslatedCategoryName } from '../utils/categoryUtils';
import { useCart } from '../contexts/CartContext';
import Toast from '../components/ui/Toast';
import EmptyImagePlaceholder from '../components/ui/EmptyImagePlaceholder';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const getProductImages = (productId: number) => [
  `${API_URL}/images/product-${productId}-xl.jpg`,
  `${API_URL}/images/product-${productId}-l.jpg`,
  `${API_URL}/images/product-${productId}-m.jpg`,
  `${API_URL}/images/product-${productId}-s.jpg`,
];

const ProductDetailPage = () => {
  const [, params] = useRoute('/product/:id');
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [product, setProduct] = useState<import('../types').Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = parseInt(params?.id ?? '0', 10);
    if (!id) { setLoading(false); return; }
    fetchProduct(id)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-base-content mb-4">Product Not Found</h1>
          <p className="text-base-content/70">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Mock additional product data for detailed view
  const productDetails = {
    ...product,
    images: getProductImages(product.id),
    fullDescription: `${product.description}

This premium product features high-quality materials and exceptional craftsmanship. Perfect for daily use, it combines functionality with style to meet all your needs.

Key Features:
• Premium quality construction
• Durable and long-lasting
• Easy to use and maintain
• Satisfaction guaranteed
• Fast shipping available`,
    specifications: {
      'Brand': 'Hutoryna Market',
      'Weight': '2.5 kg',
      'Dimensions': '30 x 20 x 10 cm',
      'Material': 'Premium Quality',
      'Warranty': '2 years',
      'Origin': 'Made in Europe'
    },
    supplier: {
      name: 'Premium Suppliers Co.',
      rating: 4.8,
      location: 'Berlin, Germany',
      yearsInBusiness: 12,
      totalProducts: 1250,
      responseTime: '2 hours',
      verification: 'Verified Supplier'
    },
    reviews: {
      average: 4.6,
      total: 234,
      breakdown: {
        5: 150,
        4: 45,
        3: 25,
        2: 10,
        1: 4
      }
    },
    shipping: {
      free: product.price > 50,
      estimatedDays: '3-5 business days',
      express: '1-2 business days (+$15)',
      international: 'Available to 50+ countries'
    }
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    
    // Show toast notification
    setToastMessage(t('addedToCart', { quantity, name: product.name }));
    setShowToast(true);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="breadcrumbs text-sm mb-6">
        <ul>
          <li><a href="/" className="text-primary hover:text-primary-focus">Home</a></li>
          <li><a href="/" className="text-primary hover:text-primary-focus">Products</a></li>
          <li className="text-base-content/70">{getTranslatedCategoryName(product.categoryId, t)}</li>
          <li className="text-base-content">{product.name}</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square bg-base-200 rounded-lg overflow-hidden">
              {productDetails.images.length === 0 ? (
                <EmptyImagePlaceholder 
                  className="w-full h-full rounded-lg"
                  title="No Image Available"
                />
              ) : (
                <img 
                  src={productDetails.images[selectedImage]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const placeholder = e.currentTarget.parentElement?.querySelector('.empty-placeholder');
                    if (placeholder) {
                      (placeholder as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
              )}
              {/* Fallback placeholder hidden by default */}
              <div className="empty-placeholder w-full h-full" style={{display: 'none'}}>
                <EmptyImagePlaceholder 
                  className="w-full h-full"
                  title="Image Not Found"
                />
              </div>
            </div>
            
            {/* Thumbnail Images */}
            {productDetails.images.length > 1 && (
              <div className="flex space-x-2">
                {productDetails.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? 'border-primary' : 'border-base-300'
                    }`}
                  >
                    <img 
                      src={image} 
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const placeholder = document.createElement('div');
                        placeholder.innerHTML = `
                          <div class="w-full h-full bg-base-300 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-base-content opacity-40">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
                            </svg>
                          </div>
                        `;
                        e.currentTarget.parentElement?.appendChild(placeholder);
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">{product.name}</h1>
              <p className="text-base-content/70 mb-4">{t('category')}: {getTranslatedCategoryName(product.categoryId, t)}</p>
              
              {/* Rating */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="rating rating-sm">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <input 
                      key={star}
                      type="radio" 
                      className="mask mask-star-2 bg-orange-400" 
                      checked={star <= Math.floor(productDetails.reviews.average)}
                      readOnly
                    />
                  ))}
                </div>
                <span className="text-base-content/70">
                  {productDetails.reviews.average} ({productDetails.reviews.total} {t('reviews')})
                </span>
              </div>

              {/* Price */}
              <div className="text-4xl font-bold text-primary mb-6">₴{product.price}</div>
            </div>

            {/* Quantity and Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <span className="text-base-content">{t('quantity')}:</span>
                <div className="flex items-center space-x-2">
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-base-content">{quantity}</span>
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-lg w-full"
                onClick={handleAddToCart}
              >
                {t('addToCart')} - ₴{(product.price * quantity).toFixed(2)}
              </button>

              <div className="flex space-x-2">
                <button className="btn btn-outline flex-1">{t('addToWishlist')}</button>
                <button className="btn btn-outline flex-1">{t('compare')}</button>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="bg-base-200 p-4 rounded-lg">
              <h3 className="font-semibold text-base-content mb-2">{t('shippingInformation')}</h3>
              <ul className="text-sm text-base-content/80 space-y-1">
                <li>• {productDetails.shipping.free ? t('freeShipping') : t('shippingCostsApply')}</li>
                <li>• {t('estimatedDelivery')}: {productDetails.shipping.estimatedDays}</li>
                <li>• {t('expressShipping')}: {productDetails.shipping.express}</li>
                <li>• {productDetails.shipping.international}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Detailed Information Tabs */}
        <div className="tabs tabs-boxed mb-6">
          <input type="radio" name="product_tabs" className="tab" aria-label={t('description')} defaultChecked />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-xl font-semibold mb-4 text-base-content">{t('productDescription')}</h3>
            <div className="prose max-w-none text-base-content/80">
              {productDetails.fullDescription.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-3">{paragraph}</p>
              ))}
            </div>
          </div>

          <input type="radio" name="product_tabs" className="tab" aria-label={t('specifications')} />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-xl font-semibold mb-4 text-base-content">{t('specifications')}</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <tbody>
                  {Object.entries(productDetails.specifications).map(([key, value]) => (
                    <tr key={key}>
                      <td className="font-medium text-base-content">{key}</td>
                      <td className="text-base-content/80">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <input type="radio" name="product_tabs" className="tab" aria-label={t('supplier')} />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-xl font-semibold mb-4 text-base-content">{t('supplierInformation')}</h3>
            <div className="card bg-base-200">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-base-content">{productDetails.supplier.name}</h4>
                    <p className="text-base-content/70">{productDetails.supplier.location}</p>
                    <div className="badge badge-success mt-2">{t('verifiedSupplier')}</div>
                  </div>
                  <div className="text-right">
                    <div className="rating rating-sm">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <input 
                          key={star}
                          type="radio" 
                          className="mask mask-star-2 bg-orange-400" 
                          checked={star <= Math.floor(productDetails.supplier.rating)}
                          readOnly
                        />
                      ))}
                    </div>
                    <p className="text-sm text-base-content/70">{productDetails.supplier.rating}/5</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="stat">
                    <div className="stat-title text-xs">{t('yearsInBusiness')}</div>
                    <div className="stat-value text-lg text-primary">{productDetails.supplier.yearsInBusiness}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title text-xs">{t('totalProducts')}</div>
                    <div className="stat-value text-lg text-primary">{productDetails.supplier.totalProducts}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title text-xs">{t('responseTime')}</div>
                    <div className="stat-value text-lg text-primary">{productDetails.supplier.responseTime}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title text-xs">{t('status')}</div>
                    <div className="stat-value text-lg text-success">{t('active')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <input type="radio" name="product_tabs" className="tab" aria-label={t('reviews')} />
          <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <h3 className="text-xl font-semibold mb-4 text-base-content">{t('customerReviews')}</h3>
            
            {/* Review Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{productDetails.reviews.average}</div>
                <div className="rating rating-lg">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <input 
                      key={star}
                      type="radio" 
                      className="mask mask-star-2 bg-orange-400" 
                      checked={star <= Math.floor(productDetails.reviews.average)}
                      readOnly
                    />
                  ))}
                </div>
                <p className="text-base-content/70">{productDetails.reviews.total} {t('reviews')}</p>
              </div>
              
              <div className="space-y-2">
                {Object.entries(productDetails.reviews.breakdown).reverse().map(([stars, count]) => (
                  <div key={stars} className="flex items-center space-x-2">
                    <span className="text-sm text-base-content">{stars} ★</span>
                    <progress className="progress progress-primary w-20" value={count} max={productDetails.reviews.total}></progress>
                    <span className="text-sm text-base-content/70">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Reviews */}
            <div className="space-y-4">
              {[
                { name: 'John D.', rating: 5, comment: 'Excellent product! High quality and fast delivery.', date: '2024-01-15' },
                { name: 'Sarah M.', rating: 4, comment: 'Good value for money. Arrived as described.', date: '2024-01-10' },
                { name: 'Mike R.', rating: 5, comment: 'Perfect! Exactly what I was looking for.', date: '2024-01-08' }
              ].map((review, index) => (
                <div key={index} className="card bg-base-200">
                  <div className="card-body">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold text-base-content">{review.name}</h5>
                        <div className="rating rating-sm">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <input 
                              key={star}
                              type="radio" 
                              className="mask mask-star-2 bg-orange-400" 
                              checked={star <= review.rating}
                              readOnly
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-base-content/70">{review.date}</span>
                    </div>
                    <p className="text-base-content/80 mt-2">{review.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Toast Notification */}
        { showToast && <Toast
                        message={toastMessage}
                        type="success"
                        show={showToast}
                        onClose={() => setShowToast(false)}
                        />}
      </div>
    </>
  );
};

export default ProductDetailPage;
