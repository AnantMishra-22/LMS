"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignPutObject = presignPutObject;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("../config/env");
const apiError_1 = require("../utils/apiError");
let s3 = null;
/**
 * Checks that S3 storage env vars are configured and returns them.
 * Throws a 400 Bad Request if storage is not configured so that the backend
 * can start without AWS credentials in the free Vercel deployment.
 */
function getStorageConfig() {
    if (!env_1.env.AWS_REGION || !env_1.env.S3_BUCKET_NAME || !env_1.env.CLOUDFRONT_DOMAIN) {
        throw (0, apiError_1.badRequest)('Storage is not configured in this deployment');
    }
    return {
        region: env_1.env.AWS_REGION,
        bucket: env_1.env.S3_BUCKET_NAME,
        cloudFrontDomain: env_1.env.CLOUDFRONT_DOMAIN
    };
}
function getS3Client() {
    const cfg = getStorageConfig();
    if (!s3) {
        s3 = new client_s3_1.S3Client({ region: cfg.region });
    }
    return s3;
}
function joinUrl(base, key) {
    const b = base.replace(/\/$/, '');
    const k = key.replace(/^\//, '');
    return `${b}/${k}`;
}
async function presignPutObject(params) {
    const cfg = getStorageConfig();
    const client = getS3Client();
    const command = new client_s3_1.PutObjectCommand({
        Bucket: cfg.bucket,
        Key: params.key,
        ContentType: params.contentType
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn: params.expiresInSeconds });
    const publicUrl = joinUrl(cfg.cloudFrontDomain, params.key);
    return {
        uploadUrl,
        key: params.key,
        publicUrl,
        expiresIn: params.expiresInSeconds
    };
}
