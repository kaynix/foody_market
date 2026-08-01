import { requestJson } from './request';

export type ApplicationStatus = 'new' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

export interface SellerApplicationSummary {
  id: string;
  status: ApplicationStatus;
  amountKopecks: number;
  createdAt: string;
  updatedAt: string;
  checkoutGroupId: string;
  lineCount: number;
  itemCount: number;
}

export interface SellerApplicationDetail {
  id: string;
  status: ApplicationStatus;
  amountKopecks: number;
  createdAt: string;
  updatedAt: string;
  buyer: { name: string; phone: string };
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unit: string;
    unitPriceKopecks: number;
    quantity: number;
    lineTotalKopecks: number;
  }>;
  delivery: {
    type: 'nova_poshta' | 'pickup' | 'arrangement';
    details: string;
    instructions: string;
  };
}

export interface SellerApplicationHealth {
  channels: Array<{ provider: string; active: boolean; isPrimary: boolean }>;
  failedDeliveries: Array<{
    id: string;
    applicationId: string;
    eventType: string;
    attemptCount: number;
    lastError: string | null;
    updatedAt: string;
  }>;
}

export function fetchSellerApplications(filters: {
  status?: ApplicationStatus;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<{
  applications: SellerApplicationSummary[];
  health: SellerApplicationHealth;
}> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.dateFrom) query.set('dateFrom', new Date(filters.dateFrom).toISOString());
  if (filters.dateTo) query.set('dateTo', new Date(filters.dateTo).toISOString());
  const suffix = query.size ? `?${query}` : '';
  return requestJson(`/api/seller/applications${suffix}`);
}

export function fetchSellerApplication(applicationId: string): Promise<SellerApplicationDetail> {
  return requestJson(`/api/seller/applications/${applicationId}`);
}

export function transitionSellerApplication(
  applicationId: string,
  status: 'accepted' | 'rejected' | 'completed',
) {
  return requestJson<{ id: string; status: ApplicationStatus; changed: boolean }>(
    `/api/seller/applications/${applicationId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }), csrf: true },
  );
}

export function retrySellerDelivery(eventId: string) {
  return requestJson<{ queued: true }>(`/api/seller/applications/outbox/${eventId}/retry`, {
    method: 'POST', body: '{}', csrf: true,
  });
}
