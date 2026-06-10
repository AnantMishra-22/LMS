"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testLimiter = exports.submitLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const env_1 = require("../config/env");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
function limiter(options) {
    return async (req, res, next) => {
        const identifier = options.keyGenerator(req);
        const endpoint = `${req.method}:${req.baseUrl}${req.path}`;
        const key = `${options.keyPrefix}:${identifier}:${endpoint}`;
        try {
            const count = await redis_1.redis.incr(key);
            if (count === 1) {
                await redis_1.redis.pexpire(key, options.windowMs);
            }
            if (count > options.max) {
                return res.status(429).json({ error: 'Too many requests' });
            }
            return next();
        }
        catch (err) {
            // Fail open if Redis is down — availability > rate limiting.
            logger_1.logger.error({ err }, 'rate limiter redis error (fail-open)');
            return next();
        }
    };
}
function getIp(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
}
exports.generalLimiter = limiter({
    keyPrefix: 'rate:ip',
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: env_1.env.RATE_LIMIT_MAX,
    keyGenerator: (req) => getIp(req)
});
exports.authLimiter = limiter({
    keyPrefix: 'rate:auth',
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: 10,
    keyGenerator: (req) => getIp(req)
});
exports.submitLimiter = limiter({
    keyPrefix: 'rate:submit',
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: 5,
    keyGenerator: (req) => req.user?.id ?? getIp(req)
});
exports.testLimiter = limiter({
    keyPrefix: 'rate:test',
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: 3,
    keyGenerator: (req) => req.user?.id ?? getIp(req)
});
