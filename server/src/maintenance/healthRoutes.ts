import { Router } from 'express';
import type { AppEnv } from '../config/env';
import type { Database } from '../db/client';
import type { Pool } from 'pg';
import { HeartbeatService } from './heartbeatService';

export function createHealthRouter(config: AppEnv, db: Database, pool: Pool) {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'hutorynok-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (_request, response) => {
    try {
      await pool.query('select 1');
      const now = Date.now();
      const workers = (await HeartbeatService.list(db)).map((worker) => ({
        name: worker.workerName,
        lastSeenAt: worker.lastSeenAt,
        status: now - worker.lastSeenAt.getTime() <= config.WORKER_STALE_SECONDS * 1000
          ? 'healthy'
          : 'stale',
        metadata: worker.metadata,
      }));
      response.json({
        status: 'ready',
        dependencies: {
          postgresql: 'ready',
          storage: { status: 'configured', driver: config.STORAGE_DRIVER },
          workers,
        },
        note: 'Messaging provider availability does not gate API readiness',
      });
    } catch {
      response.status(503).json({
        status: 'not_ready',
        dependencies: { postgresql: 'unavailable', storage: { driver: config.STORAGE_DRIVER } },
      });
    }
  });

  return router;
}
