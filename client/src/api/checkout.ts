import { requestJson } from './request';

export interface CheckoutLine { productId: string; quantity: number }
export interface CheckoutCreateLine extends CheckoutLine { expectedPriceKopecks: number }
export interface CheckoutDeliveryOption {
  id: string;
  type: 'nova_poshta' | 'pickup' | 'arrangement';
  instructions: string;
}
export interface CheckoutGroup {
  seller: { id: string; slug: string; storeName: string };
  items: Array<{
    productId: string;
    name: string;
    unit: string;
    priceKopecks: number;
    quantity: number;
    lineTotalKopecks: number;
  }>;
  deliveryOptions: CheckoutDeliveryOption[];
  subtotalKopecks: number;
}
export interface CheckoutValidation {
  valid: boolean;
  groups: CheckoutGroup[];
  errors: Array<{
    scope: 'line' | 'seller';
    code: string;
    productId?: string;
    sellerId?: string;
    message: string;
  }>;
}

export function validateCheckout(lines: CheckoutLine[]): Promise<CheckoutValidation> {
  return requestJson('/api/checkout/validate', {
    method: 'POST', body: JSON.stringify({ lines }),
  });
}

export function createCheckout(input: {
  lines: CheckoutCreateLine[];
  buyer: { name: string; phone: string };
  channel: { provider: string; browserSecret: string };
  deliveries: Array<{ sellerId: string; type: CheckoutDeliveryOption['type']; details: string }>;
}): Promise<{
  groupId: string;
  applicationIds: string[];
  acceptedProductIds: string[];
  trackingToken: string;
}> {
  return requestJson('/api/checkout', { method: 'POST', body: JSON.stringify(input) });
}

export interface TrackingGroup {
  id: string;
  createdAt: string;
  applications: Array<{
    id: string;
    status: 'new' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    amountKopecks: number;
    createdAt: string;
    updatedAt: string;
    seller: { id: string; slug: string; storeName: string };
    items: Array<{
      id: string;
      productId: string | null;
      productName: string;
      unit: string;
      unitPriceKopecks: number;
      quantity: number;
      lineTotalKopecks: number;
    }>;
    delivery: { type: CheckoutDeliveryOption['type']; details: string; instructions: string };
    contacts: Array<{ id: string; type: string; label: string; value: string }>;
  }>;
}

export function fetchTracking(groupId: string, token: string): Promise<TrackingGroup> {
  return requestJson(`/api/tracking/${groupId}`, { headers: { 'x-tracking-token': token } });
}

export function cancelTrackedApplication(groupId: string, applicationId: string, token: string) {
  return requestJson<{ id: string; status: 'cancelled' }>(
    `/api/tracking/${groupId}/applications/${applicationId}/cancel`,
    { method: 'POST', body: '{}', headers: { 'x-tracking-token': token } },
  );
}

export const trackingStorageKey = (groupId: string) => `hutorynok.tracking.${groupId}`;
