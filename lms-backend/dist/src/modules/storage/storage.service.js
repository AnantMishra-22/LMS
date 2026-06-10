"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignUpload = presignUpload;
const uuid_1 = require("uuid");
const s3_1 = require("../../utils/s3");
const apiError_1 = require("../../utils/apiError");
const allowedContentTypes = new Set(['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']);
function sanitizeFilename(name) {
    return name
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .slice(0, 120);
}
function sanitizePrefix(prefix) {
    const cleaned = prefix
        .trim()
        .replace(/^\/+/, '')
        .replace(/\.+/g, '')
        .replace(/[^a-zA-Z0-9/_-]+/g, '')
        .replace(/\/+$/g, '');
    return cleaned.length > 0 ? cleaned : 'uploads';
}
async function presignUpload(input) {
    if (!allowedContentTypes.has(input.contentType)) {
        throw (0, apiError_1.badRequest)('Unsupported content type');
    }
    if (input.key) {
        const key = input.key.replace(/^\/+/, '');
        if (key.includes('..'))
            throw (0, apiError_1.badRequest)('Invalid key');
        return (0, s3_1.presignPutObject)({
            key,
            contentType: input.contentType,
            expiresInSeconds: 3600
        });
    }
    const prefix = sanitizePrefix(input.prefix ?? 'uploads');
    const filename = input.filename ? sanitizeFilename(input.filename) : '';
    const key = filename
        ? `${prefix}/${(0, uuid_1.v4)()}-${filename}`
        : `${prefix}/${(0, uuid_1.v4)()}`;
    return (0, s3_1.presignPutObject)({
        key,
        contentType: input.contentType,
        expiresInSeconds: 3600
    });
}
