import { desc } from 'drizzle-orm';
import type { Database } from '../db/client';
import { workerHeartbeats } from '../db/schema';

export class HeartbeatService {
  private lastWrittenAt = 0;

  constructor(
    private readonly db: Database,
    private readonly workerName: string,
    private readonly minimumIntervalMs = 15_000,
  ) {}

  async beat(metadata: Record<string, unknown> = {}, force = false) {
    const now = Date.now();
    if (!force && now - this.lastWrittenAt < this.minimumIntervalMs) return;
    this.lastWrittenAt = now;
    await this.db.insert(workerHeartbeats).values({
      workerName: this.workerName,
      lastSeenAt: new Date(now),
      metadata,
    }).onConflictDoUpdate({
      target: workerHeartbeats.workerName,
      set: { lastSeenAt: new Date(now), metadata },
    });
  }

  static list(db: Database) {
    return db.select().from(workerHeartbeats).orderBy(desc(workerHeartbeats.lastSeenAt));
  }
}
