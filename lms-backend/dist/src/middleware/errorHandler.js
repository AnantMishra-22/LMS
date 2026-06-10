"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const logger_1 = require("../config/logger");
const apiError_1 = require("../utils/apiError");
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function getStringProp(obj, key) {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
}
function isPrismaKnownRequestError(err) {
    if (!isRecord(err))
        return false;
    return getStringProp(err, 'name') === 'PrismaClientKnownRequestError' && typeof err.code === 'string';
}
const errorHandler = (err, _req, res, _next) => {
    const requestId = typeof res.getHeader('x-request-id') === 'string' ? res.getHeader('x-request-id') : undefined;
    const withRequestId = (payload) => requestId ? { ...payload, requestId } : payload;
    if (err instanceof zod_1.ZodError) {
        return res.status(422).json({
            ...withRequestId({
                error: 'Validation failed',
                details: err.issues
            })
        });
    }
    if (isPrismaKnownRequestError(err)) {
        if (err.code === 'P2002') {
            return res.status(409).json(withRequestId({ error: 'Already exists' }));
        }
        if (err.code === 'P2025') {
            return res.status(404).json(withRequestId({ error: 'Not found' }));
        }
    }
    if (err instanceof apiError_1.ApiError) {
        return res.status(err.statusCode).json(withRequestId({ error: err.message }));
    }
    // JWT errors can bubble up from refresh endpoints.
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
        return res.status(401).json(withRequestId({ error: 'Invalid token' }));
    }
    logger_1.logger.error({ err }, 'unhandled error');
    return res.status(500).json(withRequestId({ error: 'Internal server error' }));
};
exports.errorHandler = errorHandler;
