"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
async function main() {
    // Validate critical environment variables early
    logger_1.logger.info({
        required: [
            'DATABASE_URL',
            'DIRECT_URL',
            'JWT_SECRET',
            'REDIS_URL',
            'QSTASH_TOKEN',
            'COMPILER_SERVICE_URL'
        ]
    }, 'Starting LMS backend with env validation');
    // Crash early if dependencies are unavailable (ECS will restart the task).
    try {
        await (0, db_1.connectPrismaWithRetry)(5, 1000);
    }
    catch (err) {
        logger_1.logger.fatal({ err }, 'Failed to connect to database. Exiting.');
        process.exit(1);
    }
    try {
        await redis_1.redis.connect();
        logger_1.logger.info('Redis connected successfully');
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Redis connection failed, continuing without cache');
    }
    const app = (0, app_1.createApp)();
    const server = app.listen(env_1.env.PORT, () => {
        logger_1.logger.info({ port: env_1.env.PORT, nodeEnv: env_1.env.NODE_ENV }, 'lms-backend listening - submission pipeline ready');
    });
    const shutdown = async (signal) => {
        logger_1.logger.info({ signal }, 'shutdown started');
        server.close(() => {
            logger_1.logger.info('http server closed');
        });
        await Promise.allSettled([db_1.prisma.$disconnect(), redis_1.redis.quit()]);
        logger_1.logger.info('shutdown complete');
    };
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
}
main().catch((err) => {
    logger_1.logger.error({ err }, 'fatal startup error');
    process.exit(1);
});
