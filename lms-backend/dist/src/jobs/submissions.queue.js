"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueSubmissionJob = enqueueSubmissionJob;
const qstash_1 = require("@upstash/qstash");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const qstash = new qstash_1.Client({ token: env_1.env.QSTASH_TOKEN });
async function enqueueSubmissionJob(job) {
    const url = `${env_1.env.PUBLIC_BACKEND_URL.replace(/\/$/, '')}/api/worker/submission`;
    try {
        const response = await qstash.publishJSON({
            url,
            body: job,
            retries: 3,
            headers: {
                'content-type': 'application/json'
            }
        });
        logger_1.logger.info({
            submissionId: job.submissionId,
            problemId: job.problemId,
            language: job.language,
            qstashMessageId: response.messageId
        }, 'Submission queued through QStash');
    }
    catch (err) {
        logger_1.logger.error({ err, submissionId: job.submissionId }, 'Failed to enqueue submission through QStash');
        throw err;
    }
}
