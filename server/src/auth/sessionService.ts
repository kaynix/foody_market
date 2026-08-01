import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import { sellerSessions, sellers } from '../db/schema';
import { hashSecret } from '../security/crypto';
import { AuthError } from './errors';
import { createOpaqueToken } from './tokens';
import type { PublicSellerSession, VerifiedIdentity } from './types';

interface SellerSessionServiceOptions {
  secret: string;
  ttlHours: number;
}

export interface CreatedSellerSession {
  rawToken: string;
  expiresAt: Date;
  seller: PublicSellerSession;
}

function toPublicSeller(seller: typeof sellers.$inferSelect): PublicSellerSession {
  return {
    id: seller.id,
    status: seller.status,
    slug: seller.slug,
    storeName: seller.storeName,
    onboardingCompleted: seller.onboardingCompleted,
  };
}

export class SellerSessionService {
  constructor(
    private readonly db: Database,
    private readonly options: SellerSessionServiceOptions,
  ) {}

  async create(
    identity: VerifiedIdentity,
    previousRawToken?: string,
  ): Promise<CreatedSellerSession> {
    const providerSubjectHash = this.identityHash(identity.provider, identity.subject);
    const rawToken = createOpaqueToken();
    const tokenHash = this.sessionHash(rawToken);
    const expiresAt = new Date(Date.now() + this.options.ttlHours * 60 * 60 * 1000);

    return this.db.transaction(async (transaction) => {
      if (previousRawToken) {
        await transaction
          .update(sellerSessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(sellerSessions.tokenHash, this.sessionHash(previousRawToken)),
              isNull(sellerSessions.revokedAt),
            ),
          );
      }

      let [seller] = await transaction
        .select()
        .from(sellers)
        .where(
          and(
            eq(sellers.identityProvider, identity.provider),
            eq(sellers.providerSubjectHash, providerSubjectHash),
          ),
        )
        .limit(1);

      if (!seller) {
        const sellerId = crypto.randomUUID();
        [seller] = await transaction
          .insert(sellers)
          .values({
            id: sellerId,
            identityProvider: identity.provider,
            providerSubjectHash,
            slug: `seller-${sellerId.slice(0, 12)}`,
            storeName: 'Новий магазин',
          })
          .returning();
      }

      if (seller.status !== 'active') {
        throw new AuthError('Seller account is blocked', 403, 'SELLER_BLOCKED');
      }

      await transaction.insert(sellerSessions).values({
        sellerId: seller.id,
        tokenHash,
        expiresAt,
      });

      return { rawToken, expiresAt, seller: toPublicSeller(seller) };
    });
  }

  async resolve(rawToken: string): Promise<PublicSellerSession | null> {
    const [row] = await this.db
      .select({ seller: sellers })
      .from(sellerSessions)
      .innerJoin(sellers, eq(sellerSessions.sellerId, sellers.id))
      .where(
        and(
          eq(sellerSessions.tokenHash, this.sessionHash(rawToken)),
          isNull(sellerSessions.revokedAt),
          gt(sellerSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row || row.seller.status !== 'active') return null;
    return toPublicSeller(row.seller);
  }

  async revoke(rawToken: string): Promise<void> {
    await this.db
      .update(sellerSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sellerSessions.tokenHash, this.sessionHash(rawToken)),
          isNull(sellerSessions.revokedAt),
        ),
      );
  }

  private identityHash(provider: string, subject: string): string {
    return hashSecret(`${provider}:${subject}`, this.options.secret);
  }

  private sessionHash(rawToken: string): string {
    return hashSecret(rawToken, this.options.secret);
  }
}
