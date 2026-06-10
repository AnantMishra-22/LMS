import { Receiver } from '@upstash/qstash';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '@/config/db';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { processSubmission } from '@/jobs/submissions.processor';
import type { SubmissionJob } from '@/jobs/submissions.queue';

export const workerRouter = Router();

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY
});

const submissionJobSchema = z.object({
  submissionId: z.string().uuid(),
  userId: z.string().uuid(),
  problemId: z.string().uuid(),
  language: z.enum(['python', 'c', 'cpp', 'java']),
  code: z.string().min(1).max(env.SUBMISSION_CODE_MAX_BYTES),
  contestId: z.string().uuid().optional()
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
workerRouter.post('/submission', async (req, res, next) => {
  try {
    const signature = req.header('Upstash-Signature');

    // Resolve the raw body string for signature verification.
    // req.rawBody is populated by the express.json verify callback in app.ts.
    const rawBodyValue: unknown = (req as { rawBody?: unknown }).rawBody;
    const body: string =
      typeof rawBodyValue === 'string'
        ? rawBodyValue
        : rawBodyValue instanceof Buffer
          ? rawBodyValue.toString('utf8')
          : JSON.stringify(req.body ?? {});

    if (!signature) {
      logger.warn('QStash request missing Upstash-Signature header');
      return res.status(401).json({ error: 'Missing QStash signature' });
    }

    const url = `${env.PUBLIC_BACKEND_URL.replace(/\/$/, '')}${req.originalUrl}`;

    const valid = await receiver.verify({
      signature,
      body,
      url
    });

    if (!valid) {
      logger.warn({ url }, 'Invalid QStash signature');
      return res.status(401).json({ error: 'Invalid QStash signature' });
    }

    const parsed = submissionJobSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.flatten() }, 'Invalid QStash submission job payload');
      return res.status(400).json({ error: 'Invalid submission job payload' });
    }

    const job = parsed.data satisfies SubmissionJob;

    const submission = await prisma.submission.findUnique({
      where: { id: job.submissionId },
      select: { id: true, status: true }
    });

    if (!submission) {
      logger.warn({ submissionId: job.submissionId }, 'QStash job references missing submission');
      return res.status(200).json({ status: 'skipped', reason: 'submission_not_found' });
    }

    if (submission.status !== 'pending') {
      logger.info(
        { submissionId: job.submissionId, currentStatus: submission.status },
        'QStash job skipped because submission is already processed or running'
      );
      return res.status(200).json({ status: 'skipped', reason: 'not_pending' });
    }

    await processSubmission(job);

    return res.status(200).json({ status: 'processed', submissionId: job.submissionId });
  } catch (err) {
    return next(err);
  }
});
