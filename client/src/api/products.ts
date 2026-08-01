import { requestJson } from './request';

export interface ManagedProduct {
  id: string;
  categoryId: number;
  name: string;
  description: string;
  priceKopecks: number;
  unit: string;
  minimumQuantity: number;
  state: 'available' | 'hidden';
  acceptingApplications: boolean;
  images: Array<{
    id: string;
    altText: string;
    sortOrder: number;
    thumbnailUrl: string;
    mediumUrl: string;
    largeUrl: string;
  }>;
}

export interface ProductEditorInput {
  categoryId: number;
  name: string;
  description: string;
  priceKopecks: number;
  unit: string;
  minimumQuantity: number;
}

export async function fetchOwnProducts(): Promise<ManagedProduct[]> {
  const response = await requestJson<{ products: ManagedProduct[] }>('/api/seller/products');
  return response.products;
}

export async function createOwnProduct(
  input: ProductEditorInput,
  images: File[],
): Promise<ManagedProduct> {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.set(key, String(value));
  for (const image of images) form.append('images', image);
  const response = await requestJson<{ product: ManagedProduct }>('/api/seller/products', {
    method: 'POST',
    body: form,
    csrf: true,
  });
  return response.product;
}

export async function updateOwnProduct(
  productId: string,
  input: ProductEditorInput,
): Promise<ManagedProduct> {
  const response = await requestJson<{ product: ManagedProduct }>(
    `/api/seller/products/${productId}`,
    { method: 'PUT', body: JSON.stringify(input), csrf: true },
  );
  return response.product;
}

export async function setOwnProductState(
  productId: string,
  state: 'available' | 'hidden',
): Promise<ManagedProduct> {
  const response = await requestJson<{ product: ManagedProduct }>(
    `/api/seller/products/${productId}/state`,
    { method: 'PATCH', body: JSON.stringify({ state }), csrf: true },
  );
  return response.product;
}

export async function reorderOwnProductImages(
  productId: string,
  imageIds: string[],
): Promise<ManagedProduct> {
  const response = await requestJson<{ product: ManagedProduct }>(
    `/api/seller/products/${productId}/image-order`,
    { method: 'PATCH', body: JSON.stringify({ imageIds }), csrf: true },
  );
  return response.product;
}

export function deleteOwnProduct(productId: string): Promise<void> {
  return requestJson<void>(`/api/seller/products/${productId}`, {
    method: 'DELETE',
    body: '{}',
    csrf: true,
  });
}
