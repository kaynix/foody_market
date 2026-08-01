export interface Product {
  id: string;
  seller: {
    id: string;
    slug: string;
    storeName: string;
  };
  name: string;
  priceKopecks: number;
  categoryId: number;
  image: string | null;
  images: Array<{
    id: string;
    altText: string;
    sortOrder: number;
    thumbnailUrl: string;
    mediumUrl: string;
    largeUrl: string;
  }>;
  description: string;
  unit: string;
  minimumQuantity: number;
  acceptingApplications: boolean;
}

export interface BannerAd {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  bgColor: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface CartItem {
  productId: string;
  sellerId: string;
  quantity: number;
  productSnapshot: {
    name: string;
    priceKopecks: number;
    unit: string;
    minimumQuantity: number;
    image: string | null;
    seller: Product['seller'];
  };
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}
