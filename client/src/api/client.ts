import type { Product, BannerAd, Category } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

/** Prefix server-relative image paths (e.g. /images/...) with the API base URL */
function resolveImageUrls<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(resolveImageUrls) as T;
  if (obj !== null && typeof obj === 'object') {
    const result = { ...(obj as Record<string, unknown>) };
    for (const key of Object.keys(result)) {
      const val = result[key];
      if (key === 'image' && typeof val === 'string' && val.startsWith('/')) {
        result[key] = `${BASE_URL}${val}`;
      } else {
        result[key] = resolveImageUrls(val);
      }
    }
    return result as T;
  }
  return obj;
}

async function apiFetch<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }
  const json: ApiResponse<T> = await res.json();
  return { ...json, data: resolveImageUrls(json.data) };
}

// ── Products ────────────────────────────────────────────────────────────────

export interface ProductQueryParams {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
}

export async function fetchProducts(params?: ProductQueryParams): Promise<{ data: Product[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.categoryId !== undefined) qs.set('categoryId', String(params.categoryId));
  if (params?.search)                   qs.set('search', params.search);
  if (params?.minPrice !== undefined)   qs.set('minPrice', String(params.minPrice));
  if (params?.maxPrice !== undefined)   qs.set('maxPrice', String(params.maxPrice));
  if (params?.sortBy)                   qs.set('sortBy', params.sortBy);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch<Product[]>(`/api/products${query}`);
  return { data: res.data, total: res.total ?? res.data.length };
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await apiFetch<Product>(`/api/products/${id}`);
  return res.data;
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiFetch<Category[]>('/api/categories');
  return res.data;
}

export async function fetchCategoryBySlug(slug: string): Promise<{ category: Category; products: Product[] }> {
  const res = await apiFetch<{ category: Category; products: Product[] }>(`/api/categories/slug/${slug}`);
  return res.data;
}

// ── Banners ─────────────────────────────────────────────────────────────────

export async function fetchBanners(): Promise<BannerAd[]> {
  const res = await apiFetch<BannerAd[]>('/api/banners');
  return res.data;
}
