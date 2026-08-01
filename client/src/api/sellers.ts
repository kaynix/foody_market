import { requestJson } from './request';

export type ContactType = 'phone' | 'telegram' | 'viber' | 'whatsapp' | 'website' | 'other';
export type DeliveryType = 'nova_poshta' | 'pickup' | 'arrangement';

export interface SellerProfile {
  id: string;
  status: 'active' | 'blocked';
  slug: string;
  storeName: string;
  description: string;
  region: string;
  onboardingCompleted: boolean;
}

export interface SellerContact {
  id?: string;
  type: ContactType;
  label: string;
  value: string;
  sortOrder: number;
}

export interface SellerDeliveryOption {
  id?: string;
  type: DeliveryType;
  instructions: string;
  active: boolean;
}

export interface SellerSettings {
  profile: SellerProfile;
  contacts: SellerContact[];
  deliveryOptions: SellerDeliveryOption[];
}

export interface OnboardingInput {
  profile: Pick<SellerProfile, 'slug' | 'storeName' | 'description' | 'region'>;
  contacts: SellerContact[];
  deliveryOptions: SellerDeliveryOption[];
}

export interface PublicStorefront {
  store: Pick<SellerProfile, 'id' | 'slug' | 'storeName' | 'description' | 'region'>;
  contacts: Array<Required<Pick<SellerContact, 'id' | 'type' | 'label' | 'value'>>>;
  deliveryOptions: Array<Required<Pick<SellerDeliveryOption, 'id' | 'type' | 'instructions'>>>;
  products: Array<{
    id: string;
    categoryId: number;
    name: string;
    description: string;
    priceKopecks: number;
    unit: string;
    minimumQuantity: number;
    images: Array<{ storageKey: string; altText: string; sortOrder: number }>;
  }>;
}

export function fetchSellerSettings(): Promise<SellerSettings> {
  return requestJson<SellerSettings>('/api/seller/profile');
}

export function saveSellerOnboarding(input: OnboardingInput): Promise<SellerSettings> {
  return requestJson<SellerSettings>('/api/seller/onboarding', {
    method: 'PUT',
    body: JSON.stringify(input),
    csrf: true,
  });
}

export function fetchStorefront(slug: string): Promise<PublicStorefront> {
  return requestJson<PublicStorefront>(`/api/storefronts/${encodeURIComponent(slug)}`);
}
