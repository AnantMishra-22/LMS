# Free Vercel Deployment Guide

This guide walks you through deploying the LMS stack on **free plans only** using:

- **Frontend**: Vercel Hobby — root directory `ed-realm`
- **Backend API**: Vercel Hobby — root directory `lms-backend`
- **Database**: [Neon](https://neon.tech) Free PostgreSQL
- **Redis**: [Upstash Redis](https://upstash.com) Free
- **Queue**: [Upstash QStash](https://upstash.com/qstash) Free
- **Compiler**: Public [Piston API](https://piston.readthedocs.io) (no account needed)

---

## Prerequisites

- A GitHub account with this repo pushed
- A [Vercel](https://vercel.com) account (free Hobby plan)
- A [Neon](https://neon.tech) account (free tier)
- An [Upstash](https://upstash.com) account (free tier — Redis + QStash)
- Node.js 20 installed locally (for running migrations)

---

## Step 1: Create the Neon Database

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Choose a region close to your Vercel deployment region
3. After creation, go to **Connection Details**
4. Copy the **Pooled connection string** → this is your `DATABASE_URL`
5. Copy the **Direct connection string** → this is your `DIRECT_URL`

> **Why two URLs?** Neon's pooler (PgBouncer) is used for runtime queries.
> The direct connection is required for Prisma migrations to run correctly.

---

## Step 2: Run Database Migrations Locally

```bash
cd lms-backend
cp .env.example .env
# Fill in DATABASE_URL and DIRECT_URL with your Neon values
npx prisma migrate deploy
```

---

## Step 3: Create Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) → **Create Database** (Redis)
2. Choose the free tier and a region near your Vercel region
3. Copy the **Redis URL** (format: `rediss://...@....upstash.io:6379`) → this is your `REDIS_URL`

---

## Step 4: Create Upstash QStash

1. In the Upstash console → **QStash** → **Create**
2. Copy:
   - `QSTASH_TOKEN` — from the **Tokens** tab
   - `QSTASH_CURRENT_SIGNING_KEY` — from the **Keys** tab
   - `QSTASH_NEXT_SIGNING_KEY` — from the **Keys** tab

---

## Step 5: Deploy the Backend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
2. Set the **Root Directory** to `lms-backend`
3. Set **Framework Preset** to `Other`
4. Set **Install Command** to `npm ci`
5. Set **Build Command** to `npm run build`
6. Add all environment variables (see table below)
7. Deploy

### Backend Environment Variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `PUBLIC_BACKEND_URL` | `https://your-backend.vercel.app` |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `REDIS_URL` | Upstash Redis URL |
| `QSTASH_TOKEN` | Upstash QStash token |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash QStash current signing key |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash next signing key |
| `JWT_SECRET` | Random 32+ character string |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_SECRET` | Random 32+ character string |
| `COMPILER_SERVICE_URL` | `https://your-backend.vercel.app/api/compiler` |
| `PISTON_API_BASE_URL` | `https://emkc.org` |
| `BCRYPT_ROUNDS` | `12` |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX` | `100` |
| `COMPILER_TIMEOUT_MS` | `8000` |
| `COMPILER_MEMORY_MB` | `128` |
| `COMPILER_MAX_OUTPUT_BYTES` | `65536` |
| `SUBMISSION_CODE_MAX_BYTES` | `65536` |

> **Note**: `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN` are optional and can be left unset for the free demo. Storage endpoints will return a 400 if called without S3 configured.

---

## Step 6: Deploy the Frontend on Vercel

1. **Add New Project** → Import same repo, different settings
2. Set the **Root Directory** to `ed-realm`
3. Set **Framework Preset** to `Vite`
4. Set **Build Command** to `npm run build`
5. Set **Output Directory** to `build`
6. Add environment variables:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.vercel.app` |
| `VITE_COMPILER_URL` | `https://your-backend.vercel.app/api/compiler` |

7. Deploy

---

## Step 7: Update ALLOWED_ORIGINS

After the frontend is deployed, copy the frontend Vercel URL and:

1. Go to the **backend** Vercel project → Settings → Environment Variables
2. Update `ALLOWED_ORIGINS` to the exact frontend URL (e.g. `https://your-frontend.vercel.app`)
3. Redeploy the backend (trigger a new deployment in Vercel UI)

---

## Step 8: Bootstrap an Admin User

Run this locally with your Neon database credentials:

```bash
cd lms-backend
ADMIN_EMAIL=admin@example.com \
ADMIN_NAME="Admin User" \
ADMIN_PASSWORD="StrongPassword123!" \
DATABASE_URL="<Neon pooled URL>" \
DIRECT_URL="<Neon direct URL>" \
BCRYPT_ROUNDS=12 \
npm run bootstrap:admin
```

---

## Step 9: Verify the Deployment

1. Check the health endpoint:
   ```
   GET https://your-backend.vercel.app/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "db": "ok",
     "redis": "ok",
     "qstash": "configured",
     "compiler": "configured",
     "uptime": 1.23
   }
   ```

2. Log in via the frontend

3. Submit a test solution and verify:
   - Submission is created with status `pending`
   - QStash delivers the job to `POST /api/worker/submission`
   - Submission status updates to `completed` or `failed` with a verdict
   - Verdict is visible in the frontend

---

## How the Submission Pipeline Works

```text
Student submits code
  → POST /api/submissions (backend creates Submission row, status=pending)
  → enqueueSubmissionJob() publishes to QStash
  → QStash signs and delivers to POST /api/worker/submission
  → Worker verifies signature, runs idempotency check
  → processSubmission() calls POST /api/compiler/execute
  → Compiler wrapper calls Piston API (https://emkc.org/api/v2/execute)
  → Piston runs the code in a sandbox
  → Results flow back: Submission row updated to completed/failed + verdict
  → Frontend polls for updated status
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Health shows `qstash: missing` | `QSTASH_TOKEN` env var not set in Vercel |
| Submissions stuck in `pending` | QStash cannot reach your backend URL — check `PUBLIC_BACKEND_URL` |
| `401 Invalid QStash signature` | Signing keys mismatch — re-copy from Upstash console |
| Login works locally but fails in production | Cookie `sameSite=none` requires HTTPS — ensure both frontend and backend are on HTTPS |
| Storage endpoints return 400 | Expected — S3 is not configured in free deployment |

---

## Local Development

For local development, copy `.env.example` to `.env` and fill in your values.

To get real QStash signing keys for local testing, use the Upstash free tier.
Alternatively, to bypass signature verification **in development only**, you can add
a check in `worker.routes.ts` for `NODE_ENV=development && QSTASH_DISABLE_SIGNATURE=true`.
This bypass must **never** be present in production.
