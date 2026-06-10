"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_EXPIRES_IN = exports.REFRESH_COOKIE_NAME = void 0;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.changePassword = changePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const db_1 = require("../../config/db");
const redis_1 = require("../../config/redis");
const apiError_1 = require("../../utils/apiError");
const accessTokenPayloadSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    role: env_1.roleEnum,
    email: zod_1.z.string().email()
});
const refreshTokenPayloadSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    jti: zod_1.z.string().uuid()
});
exports.REFRESH_COOKIE_NAME = 'refreshToken';
exports.REFRESH_TOKEN_EXPIRES_IN = '7d';
function parseDurationToSeconds(value) {
    // Supports simple forms like: 900s, 15m, 7d
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
        throw new Error(`Unsupported duration format: ${value}`);
    }
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 60 * 60 * 24
    };
    return amount * multipliers[unit];
}
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: parseDurationToSeconds(env_1.env.JWT_EXPIRES_IN)
    });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.REFRESH_TOKEN_SECRET, {
        expiresIn: parseDurationToSeconds(exports.REFRESH_TOKEN_EXPIRES_IN)
    });
}
function blacklistKey(jti) {
    return `session:blacklist:${jti}`;
}
async function login(email, password) {
    const user = await db_1.prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            passwordHash: true,
            isActive: true
        }
    });
    // Avoid user enumeration: same error for missing/wrong password/inactive.
    if (!user || !user.isActive) {
        throw (0, apiError_1.unauthorized)('Invalid credentials');
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok) {
        throw (0, apiError_1.unauthorized)('Invalid credentials');
    }
    const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
    const jti = (0, uuid_1.v4)();
    const refreshToken = signRefreshToken({ id: user.id, jti });
    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl
        }
    };
}
async function refresh(refreshToken) {
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.REFRESH_TOKEN_SECRET);
    }
    catch {
        throw (0, apiError_1.unauthorized)('Invalid token');
    }
    const payload = refreshTokenPayloadSchema.parse(decoded);
    const isBlacklisted = await redis_1.redis.get(blacklistKey(payload.jti));
    if (isBlacklisted) {
        throw (0, apiError_1.unauthorized)('Invalid token');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { id: payload.id },
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true
        }
    });
    if (!user || !user.isActive) {
        throw (0, apiError_1.unauthorized)('Invalid token');
    }
    const accessToken = signAccessToken({ id: user.id, role: user.role, email: user.email });
    return { accessToken };
}
async function logout(refreshToken) {
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.REFRESH_TOKEN_SECRET);
    }
    catch {
        // If the token is already invalid/expired, treat as logged out.
        return;
    }
    const payload = refreshTokenPayloadSchema.parse(decoded);
    const exp = zod_1.z
        .object({ exp: zod_1.z.number().int().positive().optional() })
        .passthrough()
        .parse(decoded).exp;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = exp ? Math.max(0, exp - nowSeconds) : 60 * 60 * 24 * 7;
    if (ttlSeconds > 0) {
        await redis_1.redis.setex(blacklistKey(payload.jti), ttlSeconds, '1');
    }
}
async function changePassword(userId, oldPassword, newPassword) {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true, isActive: true }
    });
    if (!user || !user.isActive) {
        throw (0, apiError_1.unauthorized)('Invalid credentials');
    }
    const ok = await bcrypt_1.default.compare(oldPassword, user.passwordHash);
    if (!ok) {
        throw (0, apiError_1.unauthorized)('Invalid credentials');
    }
    const newHash = await bcrypt_1.default.hash(newPassword, env_1.env.BCRYPT_ROUNDS);
    await db_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
    });
}
