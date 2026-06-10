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
  timeoutMs: z.coerce
    .number()
    .int()
    .min(1000)
    .max(env.COMPILER_TIMEOUT_MS)
    .default(env.COMPILER_TIMEOUT_MS),
  memoryMb: z.coerce
    .number()
    .int()
    .min(64)
    .max(env.COMPILER_MEMORY_MB)
    .default(env.COMPILER_MEMORY_MB)
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

/**
 * POST /api/compiler/execute
 *
 * Proxies code execution requests to the public Piston API (https://emkc.org/api/v2/piston/execute)
 * and transforms the response into the shape expected by submissions.processor.ts.
 *
 * Request body:
 *   { language, code, stdin?, timeoutMs?, memoryMb? }
 *
 * Response shape:
 *   { stdout, stderr, exitCode, verdict, execTimeMs, outputTruncated?, stdoutBytes?, stderrBytes? }
 */
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (pistonRes.data ?? {}) as Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compile = (data.compile ?? {}) as Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const run = (data.run ?? {}) as Record<string, any>;

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

    if (
      message.includes('aborted') ||
      message.includes('timeout') ||
      message.includes('ECONNABORTED')
    ) {
      return res.status(200).json({
        stdout: '',
        stderr: 'Execution timed out',
        exitCode: null,
        verdict: 'tle',
        execTimeMs: Date.now() - started
      });
    }

    logger.error({ err }, 'Compiler wrapper failed to call Piston API');
    return next(err);
  }
});
