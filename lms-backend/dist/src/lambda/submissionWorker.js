"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// Legacy AWS Lambda SQS handler. Not used by the free Vercel deployment.
// Kept for reference only. The production path is POST /api/worker/submission (QStash HTTP push).
require("dotenv/config");
const logger_1 = require("../config/logger");
const db_1 = require("../config/db");
const submissions_processor_1 = require("../jobs/submissions.processor");
function parseJob(body) {
    return JSON.parse(body);
}
const handler = async (event) => {
    const batchItemFailures = [];
    for (const record of event.Records) {
        try {
            const job = parseJob(record.body);
            // IDEMPOTENCY CHECK: Only process if submission is still pending
            const submission = await db_1.prisma.submission.findUnique({
                where: { id: job.submissionId },
                select: { id: true, status: true }
            });
            if (!submission) {
                logger_1.logger.warn({ submissionId: job.submissionId }, 'Submission not found - may have been deleted');
                continue;
            }
            if (submission.status !== 'pending') {
                logger_1.logger.info({ submissionId: job.submissionId, currentStatus: submission.status }, 'Submission already processed - skipping (idempotency check)');
                continue;
            }
            logger_1.logger.info({ submissionId: job.submissionId, messageId: record.messageId }, 'Worker processing submission from SQS');
            await (0, submissions_processor_1.processSubmission)(job);
        }
        catch (err) {
            logger_1.logger.error({
                err,
                messageId: record.messageId,
                body: record.body.substring(0, 200)
            }, 'SQS submission record processing failed');
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return { batchItemFailures };
};
exports.handler = handler;
