"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectPrismaWithRetry = connectPrismaWithRetry;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
const logger_1 = require("./logger");
function createPrismaClient() {
    return new client_1.PrismaClient({
        datasourceUrl: env_1.env.DATABASE_URL,
        // Prisma will log to stdout in dev; pino-http covers request logs.
        log: env_1.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error']
    });
}
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (env_1.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
// For debugging connection issues
async function connectPrismaWithRetry(maxAttempts = 5, delayMs = 1000) {
    let lastError;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            await exports.prisma.$connect();
            logger_1.logger.info('Prisma connected successfully');
            return true;
        }
        catch (err) {
            lastError = err;
            logger_1.logger.warn({
                attempt: i,
                maxAttempts,
                error: err instanceof Error ? err.message : String(err)
            }, 'Prisma connection attempt failed (P1000 errors indicate DB is unreachable)');
            // Check for P1000 specifically
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (errorMsg.includes('P1000')) {
                logger_1.logger.error({
                    detail: 'P1000 error indicates connection timeout. Verify:',
                    tips: [
                        '1. DATABASE_URL is correct (postgresql://user:pass@host:5432/dbname)',
                        '2. PostgreSQL service is running (docker-compose up -d for local)',
                        '3. Network connectivity to DB host',
                        '4. DB user/password are correct',
                        '5. Use Neon: DATABASE_URL=postgresql://user:password@ep-xxx.region.neon.tech/dbname?sslmode=require',
                        '6. Use Supabase: DATABASE_URL provided in Supabase dashboard'
                    ]
                }, 'P1000 Database Connection Error');
            }
            if (i < maxAttempts) {
                const wait = delayMs * i; // exponential backoff
                logger_1.logger.info({ waitMs: wait }, `Retrying in ${wait}ms...`);
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
        }
    }
    logger_1.logger.error({ lastError }, `Failed to connect to Prisma after ${maxAttempts} attempts`);
    throw lastError;
}
