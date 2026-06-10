"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerRouter = void 0;
const qstash_1 = require("@upstash/qstash");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const submissions_processor_1 = require("../../jobs/submissions.processor");
exports.workerRouter = (0, express_1.Router)();
const receiver = new qstash_1.Receiver({
    currentSigningKey: env_1.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env_1.env.QSTASH_NEXT_SIGNING_KEY
});
const submissionJobSchema = zod_1.z.object({
    submissionId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    problemId: zod_1.z.string().uuid(),
    language: zod_1.z.enum(['python', 'c', 'cpp', 'java']),
    code: zod_1.z.string().min(1).max(env_1.env.SUBMISSION_CODE_MAX_BYTES),
    contestId: zod_1.z.string().uuid().optional()
});
/**
 * POST /api/worker/submission
 *
 * Endpoint called by Upstash QStash when a submission job is ready to process.
 * This route:
 *   1. Verifies the QStash HMAC signature.
 *   2. Validates the job payload with Zod.
 *   3. Idempotently skips submissions that are no longer pending.
 *   4. Calls processSubmission(job) to run the code against test cases.
 *   5. Returns 200 only after processing succeeds or is idempotently skipped.
 *
 * This route is registered BEFORE the global API rate limiter so QStash can
 * deliver to it without triggering the user-facing rate limit.
 */
exports.workerRouter.post('/submission', async (req, res, next) => {
    try {
        const signature = req.header('Upstash-Signature');
        // Resolve the raw body string for signature verification.
        // req.rawBody is populated by the express.json verify callback in app.ts.
        const rawBodyValue = req.rawBody;
        const body = typeof rawBodyValue === 'string'
            ? rawBodyValue
            : rawBodyValue instanceof Buffer
                ? rawBodyValue.toString('utf8')
                : JSON.stringify(req.body ?? {});
        if (!signature) {
            logger_1.logger.warn('QStash request missing Upstash-Signature header');
            return res.status(401).json({ error: 'Missing QStash signature' });
        }
        const url = `${env_1.env.PUBLIC_BACKEND_URL.replace(/\/$/, '')}${req.originalUrl}`;
        const valid = await receiver.verify({
            signature,
            body,
            url
        });
        if (!valid) {
            logger_1.logger.warn({ url }, 'Invalid QStash signature');
            return res.status(401).json({ error: 'Invalid QStash signature' });
        }
        const parsed = submissionJobSchema.safeParse(req.body);
        if (!parsed.success) {
            logger_1.logger.warn({ issues: parsed.error.flatten() }, 'Invalid QStash submission job payload');
            return res.status(400).json({ error: 'Invalid submission job payload' });
        }
        const job = parsed.data;
        const submission = await db_1.prisma.submission.findUnique({
            where: { id: job.submissionId },
            select: { id: true, status: true }
        });
        if (!submission) {
            logger_1.logger.warn({ submissionId: job.submissionId }, 'QStash job references missing submission');
            return res.status(200).json({ status: 'skipped', reason: 'submission_not_found' });
        }
        if (submission.status !== 'pending') {
            logger_1.logger.info({ submissionId: job.submissionId, currentStatus: submission.status }, 'QStash job skipped because submission is already processed or running');
            return res.status(200).json({ status: 'skipped', reason: 'not_pending' });
        }
        await (0, submissions_processor_1.processSubmission)(job);
        return res.status(200).json({ status: 'processed', submissionId: job.submissionId });
    }
    catch (err) {
        return next(err);
    }
});
