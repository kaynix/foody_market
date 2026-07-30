export interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  image: string;
  description: string;
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
  product: Product;
  quantity: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}
