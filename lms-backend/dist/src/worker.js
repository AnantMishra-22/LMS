"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const logger_1 = require("./config/logger");
const submissions_worker_1 = require("./jobs/submissions.worker");
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
    await db_1.prisma.$connect();
    await redis_1.redis.connect();
    const worker = (0, submissions_worker_1.startSubmissionsWorker)();
    const shutdown = async (signal) => {
        logger_1.logger.info({ signal }, 'worker shutdown started');
        await worker.close();
        await Promise.allSettled([db_1.prisma.$disconnect(), redis_1.redis.quit()]);
        logger_1.logger.info('worker shutdown complete');
    };
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
    logger_1.logger.info({ env: env_1.env.NODE_ENV, note: 'QStash is the production queue mechanism' }, 'worker started (stub — QStash handles production submissions)');
}
main().catch((err) => {
    logger_1.logger.error({ err }, 'fatal worker startup error');
    process.exit(1);
});
