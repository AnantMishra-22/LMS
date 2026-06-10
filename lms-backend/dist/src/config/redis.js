"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = require("./logger");
function createRedisClient() {
    return new ioredis_1.default(env_1.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: true
    });
}
const globalForRedis = globalThis;
exports.redis = globalForRedis.redis ?? createRedisClient();
if (env_1.env.NODE_ENV !== 'production') {
    globalForRedis.redis = exports.redis;
}
exports.redis.on('error', (err) => {
    logger_1.logger.error({ err }, 'redis error');
});
exports.redis.on('connect', () => {
    logger_1.logger.info('redis connected');
});
exports.redis.on('reconnecting', () => {
    logger_1.logger.warn('redis reconnecting');
});
