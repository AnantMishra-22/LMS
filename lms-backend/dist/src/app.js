"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
require("dotenv/config");
const crypto_1 = require("crypto");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const asyncHandler_1 = require("./utils/asyncHandler");
const apiError_1 = require("./utils/apiError");
const auth_1 = require("./modules/auth");
const users_1 = require("./modules/users");
const courses_1 = require("./modules/courses");
const batches_1 = require("./modules/batches");
const problems_1 = require("./modules/problems");
const storage_1 = require("./modules/storage");
const submissions_1 = require("./modules/submissions");
const contests_1 = require("./modules/contests");
const tests_1 = require("./modules/tests");
const messages_1 = require("./modules/messages");
const analytics_1 = require("./modules/analytics");
const institutions_1 = require("./modules/institutions");
const billing_1 = require("./modules/billing");
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const worker_1 = require("./modules/worker");
const compiler_1 = require("./modules/compiler");
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, pino_http_1.default)({
        logger: logger_1.logger,
        genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const requestId = typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : (0, crypto_1.randomUUID)();
            res.setHeader('x-request-id', requestId);
            return requestId;
        },
        customProps: (req) => ({
            requestId: req.id
        })
    }));
    app.use((req, res, next) => {
        if (!res.getHeader('x-request-id')) {
            const incoming = req.headers['x-request-id'];
            const requestId = typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : (0, crypto_1.randomUUID)();
            res.setHeader('x-request-id', requestId);
        }
        next();
    });
    // Preserve the raw body string so the QStash worker route can verify
    // the HMAC signature from Upstash-Signature header.
    app.use(express_1.default.json({
        limit: '1mb',
        verify: (req, _res, buf) => {
            req.rawBody = buf.toString('utf8');
        }
    }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: true,
        hsts: { maxAge: 31536000 }
    }));
    app.use((0, cors_1.default)({
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true);
            if (env_1.env.ALLOWED_ORIGINS.includes(origin)) {
                return cb(null, true);
            }
            return cb(new Error('Not allowed by CORS'));
        },
        credentials: true,
        exposedHeaders: ['x-request-id']
    }));
    app.get('/health', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        let db = 'ok';
        let redisStatus = 'ok';
        try {
            await db_1.prisma.$queryRaw `SELECT 1`;
        }
        catch (err) {
            db = 'error';
            logger_1.logger.error({ err }, 'healthcheck db failed');
        }
        try {
            await redis_1.redis.ping();
        }
        catch (err) {
            redisStatus = 'error';
            logger_1.logger.error({ err }, 'healthcheck redis failed');
        }
        const qstashStatus = env_1.env.QSTASH_TOKEN ? 'configured' : 'missing';
        const compilerStatus = env_1.env.COMPILER_SERVICE_URL ? 'configured' : 'missing';
        return res.status(200).json({
            status: 'ok',
            db,
            redis: redisStatus,
            qstash: qstashStatus,
            compiler: compilerStatus,
            uptime: process.uptime()
        });
    }));
    // QStash signs this route — register BEFORE the generic API rate limiter
    // so Upstash delivery does not get throttled by user-facing limits.
    app.use('/api/worker', worker_1.workerRouter);
    // Rate limit all remaining API routes.
    app.use('/api', rateLimiter_1.generalLimiter);
    // Compiler wrapper — proxies to Piston API.
    app.use('/api/compiler', compiler_1.compilerRouter);
    app.use('/api/auth', auth_1.authRouter);
    app.use('/api/users', users_1.usersRouter);
    app.use('/api/courses', courses_1.coursesRouter);
    app.use('/api/batches', batches_1.batchesRouter);
    app.use('/api/problems', problems_1.problemsRouter);
    app.use('/api/storage', storage_1.storageRouter);
    app.use('/api/submissions', submissions_1.submissionsRouter);
    app.use('/api/contests', contests_1.contestsRouter);
    app.use('/api/tests', tests_1.testsRouter);
    app.use('/api/messages', messages_1.messagesRouter);
    app.use('/api/analytics', analytics_1.analyticsRouter);
    app.use('/api/institutions', institutions_1.institutionsRouter);
    app.use('/api/billing', billing_1.billingRouter);
    app.use('/api/attendance', attendance_routes_1.default);
    app.use((_req, _res) => {
        throw (0, apiError_1.notFound)();
    });
    app.use(errorHandler_1.errorHandler);
    return app;
}
