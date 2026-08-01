import { requestJson } from './request';

export interface ChannelProvider {
  provider: string;
  displayName: string;
  supportsActions: boolean;
  supportsDeepLinks: boolean;
}

export interface ChannelConnection {
  id: string;
  provider: string;
  active: boolean;
  isPrimary: boolean;
  updatedAt: string;
}

export interface SellerChannels {
  connections: ChannelConnection[];
  providers: ChannelProvider[];
  defaultProvider: string | null;
}

export interface ChannelLinkIntent {
  id: string;
  browserSecret: string;
  provider: string;
  linkUrl: string;
  expiresAt: string;
  status: 'pending';
}

export function fetchSellerChannels(): Promise<SellerChannels> {
  return requestJson('/api/seller/channels');
}

export function createChannelLinkIntent(provider: string): Promise<ChannelLinkIntent> {
  return requestJson('/api/seller/channels/link-intents', {
    method: 'POST', body: JSON.stringify({ provider }), csrf: true,
  });
}

export function fetchChannelLinkStatus(browserSecret: string): Promise<{
  provider: string;
  status: 'pending' | 'confirmed' | 'consumed' | 'expired';
  expiresAt: string;
}> {
  return requestJson('/api/seller/channels/link-intents/status', {
    headers: { 'x-link-secret': browserSecret },
  });
}

export function setPrimaryChannel(provider: string): Promise<{ connections: ChannelConnection[] }> {
  return requestJson(`/api/seller/channels/${provider}/primary`, {
    method: 'PATCH', body: '{}', csrf: true,
  });
}

export function disconnectChannel(provider: string): Promise<void> {
  return requestJson(`/api/seller/channels/${provider}`, {
    method: 'DELETE', body: '{}', csrf: true,
  });
}
