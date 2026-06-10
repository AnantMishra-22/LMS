# Antigravity Directives: Convert This LMS Repo to an All-Free Vercel Deployment

## 0. Mission

You are working inside an existing repo with this structure:

```text
lms-main/
├── ed-realm/        # Vite + React frontend
├── lms-backend/     # Express + TypeScript + Prisma backend
├── docs/
├── infra/
└── vercel.json      # currently frontend-oriented
```

The goal is to make the repo deployable using **free plans only**:

- **Frontend:** Vercel Hobby, root directory `ed-realm`
- **Backend API:** Vercel Hobby, root directory `lms-backend`
- **Database:** Neon Free PostgreSQL
- **Redis:** Upstash Redis Free
- **Queue:** Upstash QStash Free
- **Demo compiler:** public Piston API through a backend wrapper route

Do **not** rewrite the product. Keep the existing application logic, Prisma schema, frontend components, authentication flow, and submission processing as intact as possible. The main migration is infrastructure-level: replace AWS SQS pull workers with QStash push delivery and make the Express backend Vercel-compatible.

---

## 1. Non-negotiable constraints

1. Use only free-plan-compatible services.
2. Remove AWS/SQS as a required runtime dependency for normal deployment.
3. Do not require Docker, ECS, Lambda, SAM, S3, CloudFront, or AWS credentials for the demo deployment.
4. Do not keep a forever-running worker process. Vercel cannot run long-poll workers.
5. Preserve the existing submission lifecycle:

```text
student submits code
→ backend creates Submission row with status=pending
→ job is queued
→ worker processes test cases
→ Submission row is updated to completed/failed with verdict
```

6. Replace the queue step like this:

```text
OLD: backend → AWS SQS → long-poll worker
NEW: backend → Upstash QStash → POST /api/worker/submission
```

7. Do not fabricate production data. If seed-user data is not provided, keep admin bootstrap/manual seeding only.
8. Preserve TypeScript strictness. The repo must pass:

```bash
cd lms-backend
npm run type-check
npm run build

cd ../ed-realm
npm run build
```

---

## 2. First inspect the repo before editing

Before changing files, inspect these files carefully:

```text
lms-backend/package.json
lms-backend/tsconfig.json
lms-backend/src/config/env.ts
lms-backend/src/app.ts
lms-backend/src/server.ts
lms-backend/src/jobs/submissions.queue.ts
lms-backend/src/jobs/submissions.worker.ts
lms-backend/src/jobs/submissions.processor.ts
lms-backend/src/modules/submissions/submissions.service.ts
lms-backend/src/modules/auth/auth.controller.ts
lms-backend/src/types/express.d.ts
lms-backend/src/utils/s3.ts
lms-backend/prisma/schema.prisma
lms-backend/.env.example
lms-backend/prisma/seed.ts
lms-backend/scripts/bootstrap-admin.ts
ed-realm/src/lib/api.ts
ed-realm/src/lib/auth-session.ts
ed-realm/src/components/ProgramizCompiler.tsx
ed-realm/vercel.json
```

The repo currently contains AWS/SQS/Lambda/SAM-oriented code. Convert it without deleting unrelated application modules.

---

## 3. Target architecture after changes

```text
Vercel frontend: ed-realm
        ↓ HTTPS API calls
Vercel backend: lms-backend Express app
        ↓
Neon Postgres via Prisma
        ↓
Upstash Redis via ioredis
        ↓
Upstash QStash submission queue
        ↓ signed HTTP push
POST /api/worker/submission
        ↓
processSubmission(...)
        ↓
POST /api/compiler/execute
        ↓
Piston API
```

---

## 4. Backend package updates

In `lms-backend/package.json`:

### Add dependency

Install:

```bash
cd lms-backend
npm install @upstash/qstash
```

This must update both `package.json` and `package-lock.json`.

### Add or update scripts

Keep existing scripts, but add a Prisma postinstall so Vercel has a generated Prisma client:

```json
"postinstall": "prisma generate"
```

Recommended backend scripts after editing:

```json
{
  "dev": "tsx watch src/server.ts",
  "worker": "tsx src/worker.ts",
  "worker:dev": "tsx watch src/worker.ts",
  "build": "tsc -p tsconfig.json && tsc-alias -p tsconfig.json",
  "start": "node dist/src/server.js",
  "postinstall": "prisma generate",
  "type-check": "tsc -p tsconfig.json --noEmit",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:deploy": "prisma migrate deploy",
  "prisma:seed": "prisma db seed",
  "bootstrap:admin": "tsx scripts/bootstrap-admin.ts"
}
```

Do not remove existing test scripts unless they are broken by the infrastructure migration and then update them properly.

---

## 5. Prisma / Neon changes

Edit:

```text
lms-backend/prisma/schema.prisma
```

Change the datasource to include `directUrl`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Reason:

- `DATABASE_URL` should use the Neon pooled connection for app/runtime.
- `DIRECT_URL` should use the direct Neon connection for Prisma migrations.

If `prisma/migrations/` does not exist, create the first migration locally after code changes:

```bash
cd lms-backend
npx prisma migrate dev --name init
```

For deployment, migrations should be applied manually/local-CI using:

```bash
npx prisma migrate deploy
```

Do **not** run migrations automatically inside Vercel serverless functions.

---

## 6. Environment schema migration

Edit:

```text
lms-backend/src/config/env.ts
```

### Required changes

Remove SQS as a required deployment variable.

Currently these are required:

```ts
AWS_REGION
S3_BUCKET_NAME
CLOUDFRONT_DOMAIN
SQS_SUBMISSIONS_QUEUE_URL
SQS_ENDPOINT
```

For the all-free Vercel deployment:

- `SQS_SUBMISSIONS_QUEUE_URL` must not be required.
- `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN` must not be required at app startup.
- Make storage variables optional and guard the storage route at runtime.

### Add these env variables

Add to the Zod schema:

```ts
PUBLIC_BACKEND_URL: z.string().url(),
DIRECT_URL: z.string().min(1),
QSTASH_TOKEN: z.string().min(1),
QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
PISTON_API_BASE_URL: z.string().url().default('https://emkc.org'),
PISTON_PYTHON_VERSION: z.string().default('3.10.0'),
PISTON_C_VERSION: z.string().default('10.2.0'),
PISTON_CPP_VERSION: z.string().default('10.2.0'),
PISTON_JAVA_VERSION: z.string().default('15.0.2'),
PISTON_JAVASCRIPT_VERSION: z.string().default('18.15.0')
```

Make these optional:

```ts
AWS_REGION: z.string().min(1).optional(),
S3_BUCKET_NAME: z.string().min(1).optional(),
CLOUDFRONT_DOMAIN: z.string().url().optional(),
SQS_ENDPOINT: z.string().url().optional(),
SQS_SUBMISSIONS_QUEUE_URL: z.string().url().optional()
```

Keep these required:

```ts
NODE_ENV
PORT
ALLOWED_ORIGINS
COMPILER_SERVICE_URL
JWT_SECRET
JWT_EXPIRES_IN
REFRESH_TOKEN_SECRET
DATABASE_URL
REDIS_URL
BCRYPT_ROUNDS
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX
COMPILER_TIMEOUT_MS
COMPILER_MEMORY_MB
COMPILER_MAX_OUTPUT_BYTES
SUBMISSION_CODE_MAX_BYTES
```

### Important TypeScript consequence

After making AWS/S3 values optional, any file that uses them must explicitly check them before use. Do not allow TypeScript errors like `string | undefined` passed into AWS SDK constructors.

---

## 7. Update `.env.example`

Edit:

```text
lms-backend/.env.example
```

Replace the AWS/SQS-centered section with free-plan deployment variables.

Use this structure:

```env
# Server
NODE_ENV=development
PORT=3000
PUBLIC_BACKEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:5173

# Auth
JWT_SECRET=change-me-change-me-change-me-change-me
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=change-me-too-change-me-too-change-me-too

# Database: Neon in production
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/lms
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/lms

# Redis: Upstash Redis in production
REDIS_URL=redis://localhost:6379

# Queue: Upstash QStash in production
QSTASH_TOKEN=replace-with-upstash-qstash-token
QSTASH_CURRENT_SIGNING_KEY=replace-with-current-signing-key
QSTASH_NEXT_SIGNING_KEY=replace-with-next-signing-key

# Compiler wrapper: backend calls /api/compiler/execute, wrapper calls Piston
COMPILER_SERVICE_URL=http://localhost:3000/api/compiler
PISTON_API_BASE_URL=https://emkc.org
PISTON_PYTHON_VERSION=3.10.0
PISTON_C_VERSION=10.2.0
PISTON_CPP_VERSION=10.2.0
PISTON_JAVA_VERSION=15.0.2
PISTON_JAVASCRIPT_VERSION=18.15.0

# Optional storage. Leave unset for free demo unless S3 is configured.
AWS_REGION=
S3_BUCKET_NAME=
CLOUDFRONT_DOMAIN=

# Security and limits
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
COMPILER_TIMEOUT_MS=8000
COMPILER_MEMORY_MB=128
COMPILER_MAX_OUTPUT_BYTES=65536
SUBMISSION_CODE_MAX_BYTES=65536

# Runner/worker settings
RUNNER_UID=10001
```

---

## 8. Replace SQS queue publisher with QStash publisher

Edit:

```text
lms-backend/src/jobs/submissions.queue.ts
```

Replace AWS SQS logic with QStash.

Expected final behavior:

- Export the same `SubmissionJob` type so existing imports remain valid.
- Export `enqueueSubmissionJob(job)` with the same function name.
- Publish JSON to:

```text
${env.PUBLIC_BACKEND_URL}/api/worker/submission
```

Use QStash `Client`.

Implementation pattern:

```ts
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
```

If the installed `@upstash/qstash` version has a slightly different return shape, adapt only the response logging. Keep the external function API the same.

---

## 9. Add QStash worker HTTP route

Create:

```text
lms-backend/src/modules/worker/worker.routes.ts
lms-backend/src/modules/worker/index.ts
```

### `src/modules/worker/index.ts`

```ts
export { workerRouter } from './worker.routes';
```

### `src/modules/worker/worker.routes.ts`

Implement one route:

```text
POST /api/worker/submission
```

Responsibilities:

1. Read `req.rawBody` exactly as received by Express.
2. Verify `Upstash-Signature` using QStash `Receiver`.
3. Validate job payload using Zod.
4. Idempotently skip jobs whose submission is no longer `pending`.
5. Call `processSubmission(job)`.
6. Return `200 OK` only after processing succeeds or idempotently skips.
7. Return `401` for invalid/missing signatures.
8. Return `400` for invalid payloads.

Implementation pattern:

```ts
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

workerRouter.post('/submission', async (req, res, next) => {
  try {
    const signature = req.header('Upstash-Signature');
    const body = typeof req.rawBody === 'string'
      ? req.rawBody
      : Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : JSON.stringify(req.body ?? {});

    if (!signature) {
      return res.status(401).json({ error: 'Missing QStash signature' });
    }

    const url = `${env.PUBLIC_BACKEND_URL.replace(/\/$/, '')}${req.originalUrl}`;

    const valid = await receiver.verify({
      signature,
      body,
      url
    });

    if (!valid) {
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
```

If the installed QStash `Receiver.verify` type signature differs, inspect the package types and adapt. Do not remove signature verification.

---

## 10. Preserve raw body for QStash signature verification

Edit:

```text
lms-backend/src/app.ts
```

Replace:

```ts
app.use(express.json({ limit: '1mb' }));
```

with:

```ts
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);
```

Then edit:

```text
lms-backend/src/types/express.d.ts
```

Add `rawBody` to the Express request type:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      rawBody?: string;
    }
  }
}
```

---

## 11. Register the worker route before global API rate limiting

Edit:

```text
lms-backend/src/app.ts
```

Remove imports of SQS health/config from the app.

Delete this import:

```ts
import { sqs } from '@/config/sqs';
```

Add this import:

```ts
import { workerRouter } from '@/modules/worker';
import { compilerRouter } from '@/modules/compiler';
```

Register the worker route before `app.use('/api', generalLimiter)`:

```ts
// QStash signs this route. Register before the generic API limiter.
app.use('/api/worker', workerRouter);

// Compiler wrapper can be rate-limited like normal API routes.
app.use('/api', generalLimiter);
app.use('/api/compiler', compilerRouter);
```

Keep all existing API module registrations after the limiter.

---

## 12. Update health check: remove SQS, report QStash configuration

Edit the `/health` handler in:

```text
lms-backend/src/app.ts
```

Remove the AWS SQS queue attribute check.

Expected health response:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "qstash": "configured",
  "compiler": "configured",
  "uptime": 123.45
}
```

Use this logic:

- `db = ok/error` after `SELECT 1`
- `redis = ok/error` after `redis.ping()`
- `qstash = configured/missing` based on presence of `env.QSTASH_TOKEN`
- `compiler = configured/missing` based on presence of `env.COMPILER_SERVICE_URL`

Do not fail health merely because optional AWS/S3 storage is not configured.

---

## 13. Disable or neutralize the old SQS long-poll worker

Files involved:

```text
lms-backend/src/jobs/submissions.worker.ts
lms-backend/src/worker.ts
lms-backend/src/lambda/submissionWorker.ts
lms-backend/src/config/sqs.ts
```

Because `tsconfig.json` includes all `src`, these files must still type-check.

Preferred approach:

1. Keep the files only as legacy compatibility stubs.
2. Do not require SQS env variables.
3. Do not start a long-running polling loop in Vercel.

Update `src/jobs/submissions.worker.ts` to something like:

```ts
import { logger } from '@/config/logger';

export function startSubmissionsWorker() {
  logger.warn('Legacy SQS worker is disabled. Submissions are processed through QStash HTTP push.');

  return {
    close: async () => {
      logger.info('Legacy worker close called');
    }
  };
}
```

Update `src/worker.ts` so it does not imply that a production worker is required. It may keep the stub behavior for local compatibility, but should log clearly that QStash is the production mechanism.

Do not leave code that imports `SQS_SUBMISSIONS_QUEUE_URL` as required.

`src/lambda/submissionWorker.ts` may remain for archived AWS deployment only if it still type-checks. Add a comment at top:

```ts
// Legacy AWS Lambda SQS handler. Not used by the free Vercel deployment.
```

Do not include it in Vercel routing.

---

## 14. Make S3 storage optional

The storage module currently depends on AWS S3 and CloudFront:

```text
lms-backend/src/utils/s3.ts
lms-backend/src/modules/storage/storage.service.ts
```

Because the all-free demo does not use AWS, the app must start without S3 env vars.

Edit `src/utils/s3.ts` to lazily require storage env only when the `/api/storage/presign` route is called.

Pattern:

```ts
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '@/config/env';
import { badRequest } from '@/utils/apiError';

let s3: S3Client | null = null;

function getStorageConfig() {
  if (!env.AWS_REGION || !env.S3_BUCKET_NAME || !env.CLOUDFRONT_DOMAIN) {
    throw badRequest('Storage is not configured in this deployment');
  }

  return {
    region: env.AWS_REGION,
    bucket: env.S3_BUCKET_NAME,
    cloudFrontDomain: env.CLOUDFRONT_DOMAIN
  };
}

function getS3Client() {
  const cfg = getStorageConfig();
  if (!s3) {
    s3 = new S3Client({ region: cfg.region });
  }
  return s3;
}
```

Then inside `presignPutObject`, call `getStorageConfig()` and `getS3Client()`.

The result: storage upload attempts return a controlled 400 error unless S3 is configured, but the backend can still deploy and operate LMS/auth/submissions on free plans.

---

## 15. Add Piston compiler wrapper module

Create:

```text
lms-backend/src/modules/compiler/compiler.routes.ts
lms-backend/src/modules/compiler/index.ts
```

Register it in `src/app.ts` as:

```ts
app.use('/api/compiler', compilerRouter);
```

### Route

```text
POST /api/compiler/execute
```

### Request shape expected by existing `submissions.processor.ts`

The processor already calls:

```ts
POST ${env.COMPILER_SERVICE_URL}/execute
```

with:

```json
{
  "language": "python | c | cpp | java",
  "code": "...",
  "stdin": "...",
  "timeoutMs": 8000,
  "memoryMb": 128
}
```

### Response shape required by existing `submissions.processor.ts`

Return exactly:

```ts
type CompilerResponse = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  verdict: 'ok' | 'tle' | 'mle' | 'rte' | 'ce';
  execTimeMs: number;
  outputTruncated?: boolean;
  stdoutBytes?: number;
  stderrBytes?: number;
};
```

### Implementation pattern

Use Axios to call Piston:

```ts
import axios from 'axios';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '@/config/env';
import { logger } from '@/config/logger';

export const compilerRouter = Router();

const executeSchema = z.object({
  language: z.enum(['python', 'c', 'cpp', 'java', 'javascript']),
  code: z.string().min(1).max(env.SUBMISSION_CODE_MAX_BYTES),
  stdin: z.string().max(100_000).default(''),
  timeoutMs: z.coerce.number().int().min(1000).max(env.COMPILER_TIMEOUT_MS).default(env.COMPILER_TIMEOUT_MS),
  memoryMb: z.coerce.number().int().min(64).max(env.COMPILER_MEMORY_MB).default(env.COMPILER_MEMORY_MB)
});

const languageConfig = {
  python: { language: 'python', version: env.PISTON_PYTHON_VERSION, filename: 'main.py' },
  c: { language: 'c', version: env.PISTON_C_VERSION, filename: 'main.c' },
  cpp: { language: 'cpp', version: env.PISTON_CPP_VERSION, filename: 'main.cpp' },
  java: { language: 'java', version: env.PISTON_JAVA_VERSION, filename: 'Main.java' },
  javascript: { language: 'javascript', version: env.PISTON_JAVASCRIPT_VERSION, filename: 'main.js' }
} as const;

function byteLen(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function truncate(value: string, maxBytes: number) {
  const buf = Buffer.from(value, 'utf8');
  if (buf.length <= maxBytes) return { value, bytes: buf.length, truncated: false };
  return { value: buf.subarray(0, maxBytes).toString('utf8'), bytes: buf.length, truncated: true };
}

compilerRouter.post('/execute', async (req, res, next) => {
  const started = Date.now();

  try {
    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        stdout: '',
        stderr: 'Invalid compiler request',
        exitCode: null,
        verdict: 'rte',
        execTimeMs: Date.now() - started
      });
    }

    const input = parsed.data;
    const cfg = languageConfig[input.language];
    const controller = new AbortController();
    const hardTimeout = Math.min(input.timeoutMs + 2000, env.COMPILER_TIMEOUT_MS + 3000);
    const timeout = setTimeout(() => controller.abort(), hardTimeout);

    try {
      const pistonRes = await axios.post(
        `${env.PISTON_API_BASE_URL.replace(/\/$/, '')}/api/v2/execute`,
        {
          language: cfg.language,
          version: cfg.version,
          files: [{ name: cfg.filename, content: input.code }],
          stdin: input.stdin,
          args: [],
          compile_timeout: input.timeoutMs,
          run_timeout: input.timeoutMs,
          compile_memory_limit: input.memoryMb * 1024 * 1024,
          run_memory_limit: input.memoryMb * 1024 * 1024
        },
        {
          timeout: hardTimeout,
          signal: controller.signal
        }
      );

      const data = pistonRes.data ?? {};
      const compile = data.compile ?? {};
      const run = data.run ?? {};

      const stdoutRaw = String(run.stdout ?? '');
      const stderrRaw = [compile.stderr, run.stderr].filter(Boolean).map(String).join('\n');
      const stdout = truncate(stdoutRaw, env.COMPILER_MAX_OUTPUT_BYTES);
      const stderr = truncate(stderrRaw, env.COMPILER_MAX_OUTPUT_BYTES);

      let verdict: 'ok' | 'tle' | 'mle' | 'rte' | 'ce' = 'ok';
      const compileCode = typeof compile.code === 'number' ? compile.code : 0;
      const runCode = typeof run.code === 'number' ? run.code : 0;

      if (compileCode !== 0 || String(compile.stderr ?? '').trim().length > 0) {
        verdict = 'ce';
      } else if (runCode !== 0 || String(run.stderr ?? '').trim().length > 0) {
        verdict = 'rte';
      }

      return res.status(200).json({
        stdout: stdout.value,
        stderr: stderr.value,
        exitCode: verdict === 'ce' ? compileCode : runCode,
        verdict,
        execTimeMs: Date.now() - started,
        outputTruncated: stdout.truncated || stderr.truncated,
        stdoutBytes: byteLen(stdoutRaw),
        stderrBytes: byteLen(stderrRaw)
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('aborted') || message.includes('timeout') || message.includes('ECONNABORTED')) {
      return res.status(200).json({
        stdout: '',
        stderr: 'Execution timed out',
        exitCode: null,
        verdict: 'tle',
        execTimeMs: Date.now() - started
      });
    }

    logger.error({ err }, 'Compiler wrapper failed');
    return next(err);
  }
});
```

Before finalizing, verify the actual Piston runtime versions. If the defaults do not work, update the env defaults or document required values. Do not hard-fail the whole backend at startup because Piston is temporarily unavailable.

---

## 16. Update `COMPILER_SERVICE_URL` usage

In deployment, `COMPILER_SERVICE_URL` should point to the backend wrapper:

```env
COMPILER_SERVICE_URL=https://your-backend.vercel.app/api/compiler
```

For local development:

```env
COMPILER_SERVICE_URL=http://localhost:3000/api/compiler
```

Do not point `COMPILER_SERVICE_URL` directly to Piston because the existing `submissions.processor.ts` expects the repo-specific compiler response shape.

---

## 17. Make backend Vercel-compatible

Create:

```text
lms-backend/api/index.ts
```

Use a default export for the Express app:

```ts
import { createApp } from '../src/app';

const app = createApp();

export default app;
```

Create:

```text
lms-backend/vercel.json
```

Use:

```json
{
  "version": 2,
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "functions": {
    "api/index.ts": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index"
    }
  ]
}
```

Do not use `src/server.ts` as the Vercel entry. Keep `src/server.ts` only for local development.

Update `src/server.ts` logging so it no longer lists `SQS_SUBMISSIONS_QUEUE_URL` as required. Replace that startup log with:

```ts
required: [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'REDIS_URL',
  'QSTASH_TOKEN',
  'COMPILER_SERVICE_URL'
]
```

---

## 18. Fix production refresh-token cookie settings

Edit:

```text
lms-backend/src/modules/auth/auth.controller.ts
```

Current cookie config uses:

```ts
sameSite: 'strict'
```

This can break auth refresh when frontend and backend are on separate Vercel domains.

Update to:

```ts
function refreshCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}
```

Reason:

- Localhost development works with `sameSite=lax`, `secure=false`.
- Cross-site Vercel frontend/backend cookies require `sameSite=none`, `secure=true`.

Keep `credentials: 'include'` in the frontend fetch logic.

---

## 19. Frontend env and optional compiler integration

The frontend already uses:

```text
VITE_API_BASE_URL
```

Keep this.

For production Vercel frontend env:

```env
VITE_API_BASE_URL=https://your-backend.vercel.app
VITE_COMPILER_URL=https://your-backend.vercel.app/api/compiler
```

### Optional but recommended: update `ProgramizCompiler.tsx`

The current `ProgramizCompiler` simulates execution with `setTimeout`. Replace simulation with the backend compiler wrapper:

```text
POST ${VITE_COMPILER_URL}/execute
```

Request body:

```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": "",
  "timeoutMs": 8000,
  "memoryMb": 128
}
```

Render returned `stdout` and `stderr`. If the call fails, show a clear toast and output error.

Do not block the main submission flow on this optional UI improvement.

---

## 20. Update frontend Vercel config only if necessary

`ed-realm/vercel.json` is already mostly correct:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Keep this unless the Vercel project root is not `ed-realm`. The intended deployment is two separate Vercel projects:

```text
Project 1: frontend → root directory ed-realm
Project 2: backend  → root directory lms-backend
```

---

## 21. Disable AWS deployment workflow so GitHub does not fail

The repo contains an AWS-oriented workflow:

```text
lms-backend/.github/workflows/deploy.yml
```

This currently references AWS credentials, SAM, ECR, ECS, and Docker compiler deployment. It is not part of the free Vercel deployment.

Do one of the following:

### Preferred

Change it to manual only:

```yaml
on:
  workflow_dispatch:
```

and add a comment:

```yaml
# Legacy AWS deployment workflow. Not used for Vercel free-plan deployment.
```

### Alternative

Rename to:

```text
lms-backend/.github/workflows/aws-deploy.disabled.yml
```

Do not leave it auto-running on every push to `main`.

---

## 22. Update logs and messages from SQS to QStash

Search the backend for these strings:

```text
SQS
sqs
queue URL
long-poll
worker polling
```

Update logs that are part of the active Vercel path.

Examples:

In `submissions.service.ts`, change:

```ts
'Submission created, enqueueing to SQS'
```

to:

```ts
'Submission created, enqueueing through QStash'
```

Change:

```ts
'Submission enqueued successfully - waiting for worker processing'
```

to:

```ts
'Submission enqueued successfully - waiting for QStash worker callback'
```

Do not leave active user-facing or runtime logs saying SQS is required.

---

## 23. Testing requirements

After changes, run locally:

```bash
cd lms-backend
npm ci
npm run type-check
npm run build
```

Then:

```bash
cd ../ed-realm
npm ci
npm run build
```

If backend tests depend on SQS, update or skip only those tests with a clear comment. Do not silently delete meaningful tests.

### Local smoke test

With local env values set:

```bash
cd lms-backend
npm run dev
```

Check:

```text
GET http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "qstash": "configured",
  "compiler": "configured"
}
```

If local QStash keys are not available, env validation will fail. For local development, either use real QStash free keys or add a documented development bypass only when `NODE_ENV=development` and `QSTASH_DISABLE_SIGNATURE=true`. Do **not** allow signature bypass in production.

---

## 24. Deployment instructions to document in repo

Create:

```text
lms-backend/docs/free-vercel-deployment.md
```

Include these steps:

1. Create Neon Free DB.
2. Copy pooled connection to `DATABASE_URL`.
3. Copy direct connection to `DIRECT_URL`.
4. Run migrations:

```bash
cd lms-backend
npx prisma migrate deploy
```

5. Create Upstash Redis Free DB and copy `REDIS_URL`.
6. Create Upstash QStash and copy:

```text
QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
```

7. Deploy backend on Vercel:

```text
Root Directory: lms-backend
Framework Preset: Other
Install Command: npm ci
Build Command: npm run build
```

8. Set backend env vars:

```env
NODE_ENV=production
PORT=3000
PUBLIC_BACKEND_URL=https://your-backend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app
DATABASE_URL=<Neon pooled URL>
DIRECT_URL=<Neon direct URL>
REDIS_URL=<Upstash Redis URL>
QSTASH_TOKEN=<QStash token>
QSTASH_CURRENT_SIGNING_KEY=<current signing key>
QSTASH_NEXT_SIGNING_KEY=<next signing key>
JWT_SECRET=<32+ char secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<32+ char secret>
COMPILER_SERVICE_URL=https://your-backend.vercel.app/api/compiler
PISTON_API_BASE_URL=https://emkc.org
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
COMPILER_TIMEOUT_MS=8000
COMPILER_MEMORY_MB=128
COMPILER_MAX_OUTPUT_BYTES=65536
SUBMISSION_CODE_MAX_BYTES=65536
```

9. Deploy frontend on Vercel:

```text
Root Directory: ed-realm
Framework Preset: Vite
Build Command: npm run build
Output Directory: build
```

10. Set frontend env vars:

```env
VITE_API_BASE_URL=https://your-backend.vercel.app
VITE_COMPILER_URL=https://your-backend.vercel.app/api/compiler
```

11. Redeploy backend after replacing `ALLOWED_ORIGINS` with the final frontend Vercel URL.
12. Bootstrap admin:

```bash
cd lms-backend
ADMIN_EMAIL=admin@example.com \
ADMIN_NAME="Admin User" \
ADMIN_PASSWORD="StrongPassword123!" \
DATABASE_URL="<Neon pooled or direct URL>" \
DIRECT_URL="<Neon direct URL>" \
BCRYPT_ROUNDS=12 \
npm run bootstrap:admin
```

13. Manually create/import users, courses, problems, and test cases.
14. Submit one test solution and verify QStash delivery logs and database status update.

---

## 25. Acceptance criteria

The task is complete only when all of these are true:

### Build / type criteria

```bash
cd lms-backend
npm run type-check
npm run build

cd ../ed-realm
npm run build
```

All pass.

### Backend startup criteria

The backend starts without any of these env vars:

```text
AWS_REGION
S3_BUCKET_NAME
CLOUDFRONT_DOMAIN
SQS_SUBMISSIONS_QUEUE_URL
SQS_ENDPOINT
```

### Runtime criteria

1. `GET /health` works.
2. Auth login works.
3. Refresh token works across frontend/backend Vercel domains.
4. `POST /api/submissions` creates a pending submission.
5. `enqueueSubmissionJob` publishes through QStash.
6. QStash calls `POST /api/worker/submission`.
7. The worker verifies the QStash signature.
8. The worker calls `processSubmission(job)`.
9. `processSubmission` calls the local backend compiler wrapper.
10. The compiler wrapper calls Piston.
11. The submission becomes `completed` or `failed` with a verdict.
12. The frontend can fetch and display the updated submission status.

### Security criteria

1. QStash worker route rejects missing/invalid signatures.
2. No signature bypass in production.
3. CORS uses exact frontend origin, not `*`.
4. Cookies use `sameSite=none` and `secure=true` in production.
5. Storage route does not expose AWS errors when storage env is missing.

### Free-plan criteria

No required deployment step depends on:

```text
AWS
Docker runtime
ECS
Lambda
SAM
S3
CloudFront
paid Redis
paid Postgres
paid queue service
```

---

## 26. Files expected to be modified or created

Expected modifications:

```text
lms-backend/package.json
lms-backend/package-lock.json
lms-backend/.env.example
lms-backend/prisma/schema.prisma
lms-backend/src/config/env.ts
lms-backend/src/app.ts
lms-backend/src/types/express.d.ts
lms-backend/src/jobs/submissions.queue.ts
lms-backend/src/jobs/submissions.worker.ts
lms-backend/src/worker.ts
lms-backend/src/modules/submissions/submissions.service.ts
lms-backend/src/modules/auth/auth.controller.ts
lms-backend/src/utils/s3.ts
lms-backend/.github/workflows/deploy.yml
```

Expected new files:

```text
lms-backend/api/index.ts
lms-backend/vercel.json
lms-backend/src/modules/worker/index.ts
lms-backend/src/modules/worker/worker.routes.ts
lms-backend/src/modules/compiler/index.ts
lms-backend/src/modules/compiler/compiler.routes.ts
lms-backend/docs/free-vercel-deployment.md
```

Optional frontend modification:

```text
ed-realm/src/components/ProgramizCompiler.tsx
```

Do not make unrelated UI redesigns.

---

## 27. Final response after completing edits

When finished, report:

1. Exact files changed.
2. Exact commands run.
3. Whether backend type-check passed.
4. Whether backend build passed.
5. Whether frontend build passed.
6. Any remaining manual deployment steps.
7. Any env vars the user must still paste into Vercel.

Do not claim deployment success unless the app was actually deployed and tested on Vercel.
