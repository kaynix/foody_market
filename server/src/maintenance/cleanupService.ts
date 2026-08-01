import { and, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  channelActionTokens,
  channelLinkIntents,
  checkoutGroups,
  sellerSessions,
} from '../db/schema';

export interface CleanupRetention {
  sessionDays: number;
  linkIntentHours: number;
  actionTokenDays: number;
}

const before = (now: Date, milliseconds: number) => new Date(now.getTime() - milliseconds);

export class CleanupService {
  constructor(private readonly db: Database, private readonly retention: CleanupRetention) {}

  async run(now = new Date()) {
    const sessionCutoff = before(now, this.retention.sessionDays * 86_400_000);
    const linkCutoff = before(now, this.retention.linkIntentHours * 3_600_000);
    const actionCutoff = before(now, this.retention.actionTokenDays * 86_400_000);

    const [sessions, links, actions, tracking] = await this.db.transaction(async (transaction) => {
      const deletedSessions = await transaction.delete(sellerSessions).where(or(
        lte(sellerSessions.expiresAt, sessionCutoff),
        and(isNotNull(sellerSessions.revokedAt), lte(sellerSessions.revokedAt, sessionCutoff)),
      )).returning({ id: sellerSessions.id });
      const deletedLinks = await transaction.delete(channelLinkIntents)
        .where(lte(channelLinkIntents.expiresAt, linkCutoff))
        .returning({ id: channelLinkIntents.id });
      const deletedActions = await transaction.delete(channelActionTokens)
        .where(lte(channelActionTokens.expiresAt, actionCutoff))
        .returning({ id: channelActionTokens.id });
      const revokedTracking = await transaction.update(checkoutGroups).set({
        trackingTokenHash: sql`'expired:' || ${checkoutGroups.id}::text`,
        trackingRevokedAt: now,
        updatedAt: now,
      }).where(and(
        lte(checkoutGroups.trackingExpiresAt, now),
        isNull(checkoutGroups.trackingRevokedAt),
      )).returning({ id: checkoutGroups.id });
      return [deletedSessions, deletedLinks, deletedActions, revokedTracking] as const;
    });

    return {
      sessions: sessions.length,
      linkIntents: links.length,
      actionTokens: actions.length,
      trackingCredentials: tracking.length,
    };
  }
}
