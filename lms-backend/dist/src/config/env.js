"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleEnum = exports.env = void 0;
const zod_1 = require("zod");
const roleSchema = zod_1.z.enum(['student', 'faculty', 'trainer', 'admin']);
const envSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535),
    // Frontend
    ALLOWED_ORIGINS: zod_1.z
        .string()
        .min(1)
        .transform((value) => value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)),
    // Public URL for QStash callback (this backend's own URL)
    PUBLIC_BACKEND_URL: zod_1.z.string().url(),
    // Services
    COMPILER_SERVICE_URL: zod_1.z.string().min(1),
    // Auth
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().min(1),
    REFRESH_TOKEN_SECRET: zod_1.z.string().min(32),
    // DB
    DATABASE_URL: zod_1.z.string().min(1),
    DIRECT_URL: zod_1.z.string().min(1),
    // Redis
    REDIS_URL: zod_1.z.string().min(1),
    // AWS (optional — only needed when S3 storage is configured)
    AWS_REGION: zod_1.z.string().min(1).optional(),
    S3_BUCKET_NAME: zod_1.z.string().min(1).optional(),
    CLOUDFRONT_DOMAIN: zod_1.z.string().url().optional(),
    SQS_ENDPOINT: zod_1.z.string().url().optional(),
    SQS_SUBMISSIONS_QUEUE_URL: zod_1.z.string().url().optional(),
    // QStash (required — Upstash free plan)
    QSTASH_TOKEN: zod_1.z.string().min(1),
    QSTASH_CURRENT_SIGNING_KEY: zod_1.z.string().min(1),
    QSTASH_NEXT_SIGNING_KEY: zod_1.z.string().min(1),
    // Piston compiler API (defaults to public Piston instance)
    PISTON_API_BASE_URL: zod_1.z.string().url().default('https://emkc.org'),
    PISTON_PYTHON_VERSION: zod_1.z.string().default('3.10.0'),
    PISTON_C_VERSION: zod_1.z.string().default('10.2.0'),
    PISTON_CPP_VERSION: zod_1.z.string().default('10.2.0'),
    PISTON_JAVA_VERSION: zod_1.z.string().default('15.0.2'),
    PISTON_JAVASCRIPT_VERSION: zod_1.z.string().default('18.15.0'),
    // Security
    BCRYPT_ROUNDS: zod_1.z.coerce.number().int().min(10).max(15),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().min(1000),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().int().min(1),
    COMPILER_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(15000),
    COMPILER_MEMORY_MB: zod_1.z.coerce.number().int().min(64).max(1024),
    COMPILER_MAX_OUTPUT_BYTES: zod_1.z.coerce.number().int().min(1024).max(262144).default(65536),
    SUBMISSION_CODE_MAX_BYTES: zod_1.z.coerce.number().int().min(1024).max(262144).default(65536),
    // Runner/worker settings
    RUNNER_UID: zod_1.z.coerce.number().int().min(1).optional()
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const missing = parsed.error.issues
        .filter((i) => i.code === 'invalid_type' && i.received === 'undefined')
        .map((i) => i.path.join('.'));
    // eslint-disable-next-line no-console
    console.error('[env] ❌ STARTUP FAILED: Missing required environment variables:');
    for (const name of missing) {
        // eslint-disable-next-line no-console
        console.error(`  - ${name}`);
    }
    // eslint-disable-next-line no-console
    console.error('\n[env] Use .env.example as template: cp .env.example .env');
    // eslint-disable-next-line no-console
    console.error('[env] All validation issues:', parsed.error.flatten());
    process.exit(1);
}
exports.env = parsed.data;
// Re-export runtime enums that are used across the app.
exports.roleEnum = roleSchema;
