"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSubmissionsWorker = startSubmissionsWorker;
const logger_1 = require("../config/logger");
/**
 * Legacy SQS long-poll worker stub.
 *
 * The production submission pipeline now uses Upstash QStash HTTP push.
 * QStash delivers jobs by calling POST /api/worker/submission on this backend.
 *
 * This file is kept as a stub so that `src/worker.ts` can still import it
 * without requiring SQS environment variables or starting a polling loop.
 */
function startSubmissionsWorker() {
    logger_1.logger.warn('Legacy SQS worker is disabled. Submissions are processed through QStash HTTP push at POST /api/worker/submission.');
    return {
        close: async () => {
            logger_1.logger.info('Legacy worker close called (no-op)');
        }
    };
}
