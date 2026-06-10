import 'dotenv/config';

import { env } from '@/config/env';
import { prisma } from '@/config/db';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';

import { startSubmissionsWorker } from '@/jobs/submissions.worker';

/**
 * Local development worker entry point.
 *
 * NOTE: In the free Vercel deployment, submissions are NOT processed by this
 * long-running process. Instead, Upstash QStash delivers jobs via HTTP push
 * to POST /api/worker/submission on the backend Vercel function.
 *
 * This file can still be run locally for debugging, but `startSubmissionsWorker`
 * is now a no-op stub that logs a warning.
 */
async function main() {
  await prisma.$connect();
  await redis.connect();

  const worker = startSubmissionsWorker();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutdown started');

    await worker.close();

    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    logger.info('worker shutdown complete');
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  logger.info(
    { env: env.NODE_ENV, note: 'QStash is the production queue mechanism' },
    'worker started (stub — QStash handles production submissions)'
  );
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal worker startup error');
  process.exit(1);
});
