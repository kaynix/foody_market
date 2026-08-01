export type IdentityProviderName = 'development' | 'diia';

export interface VerifiedIdentity {
  provider: IdentityProviderName;
  subject: string;
  verifiedAt: Date;
}

export interface IdentityStartResult {
  mode: 'local' | 'redirect';
  authorizationUrl?: string;
}

export interface IdentityProvider {
  readonly name: IdentityProviderName;
  readonly displayName: string;
  isAvailable(): boolean;
  begin(): Promise<IdentityStartResult>;
  complete(payload: unknown): Promise<VerifiedIdentity>;
}

export interface PublicSellerSession {
  id: string;
  status: 'active' | 'blocked';
  slug: string;
  storeName: string;
  onboardingCompleted: boolean;
}
