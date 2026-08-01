import { env } from '../config/env';
import { database } from '../db/client';
import { CleanupService } from '../maintenance/cleanupService';
import { HeartbeatService } from '../maintenance/heartbeatService';
import { safeErrorForLog } from '../security/redaction';

const cleanup = new CleanupService(database.db, {
  sessionDays: env.SESSION_RETENTION_DAYS,
  linkIntentHours: env.LINK_INTENT_RETENTION_HOURS,
  actionTokenDays: env.ACTION_TOKEN_RETENTION_DAYS,
});
const heartbeat = new HeartbeatService(database.db, 'cleanup');
let stopping = false;
const stop = () => { stopping = true; };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function run() {
  while (!stopping) {
    try {
      const cleaned = await cleanup.run();
      await heartbeat.beat({ cleaned }, true);
    } catch (error) {
      console.error('Cleanup cycle failed:', safeErrorForLog(error));
    }
    if (!stopping) {
      await new Promise((resolve) => setTimeout(resolve, env.CLEANUP_INTERVAL_MINUTES * 60_000));
    }
  }
  await database.pool.end();
}

run().catch((error) => {
  console.error('Cleanup worker stopped:', safeErrorForLog(error));
  process.exitCode = 1;
});
