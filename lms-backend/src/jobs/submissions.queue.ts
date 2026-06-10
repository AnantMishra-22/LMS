import { Client } from '@upstash/qstash';

import { env } from '@/config/env';
import { logger } from '@/config/logger';

export type SubmissionJob = {
  submissionId: string;
  userId: string;
  problemId: string;
  language: 'python' | 'c' | 'cpp' | 'java';
  code: string;
  contestId?: string;
};

const qstash = new Client({ token: env.QSTASH_TOKEN });

export async function enqueueSubmissionJob(job: SubmissionJob) {
  const url = `${env.PUBLIC_BACKEND_URL.replace(/\/$/, '')}/api/worker/submission`;

  try {
    const response = await qstash.publishJSON({
      url,
      body: job,
      retries: 3,
      headers: {
        'content-type': 'application/json'
      }
    });

    logger.info(
      {
        submissionId: job.submissionId,
        problemId: job.problemId,
        language: job.language,
        qstashMessageId: response.messageId
      },
      'Submission queued through QStash'
    );
  } catch (err) {
    logger.error({ err, submissionId: job.submissionId }, 'Failed to enqueue submission through QStash');
    throw err;
  }
}
