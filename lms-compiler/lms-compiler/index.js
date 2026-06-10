'use strict';
/**
 * index.js — AWS Lambda handler for the LMS multi-language compiler.
 *
 * ── Invocation payload ────────────────────────────────────────────
 * {
 *   "language": "python" | "java" | "c" | "cpp",
 *   "code":     "<source code string>",
 *   "stdin":    "<optional stdin, newline-separated>",   // default: ""
 *   "limits": {                                           // all optional
 *     "maxSteps":     500000,
 *     "maxTimeMs":    5000,
 *     "maxStack":     20000,
 *     "maxFrames":    2000,
 *     "maxHeapCells": 2000000   // python/java only
 *   }
 * }
 *
 * ── Response ──────────────────────────────────────────────────────
 * {
 *   "stdout":   "<program output>",
 *   "stderr":   "<error output, empty on success>",
 *   "exitCode": 0 | 1
 * }
 *
 * ── Local CLI usage ────────────────────────────────────────────────
 *   node index.js python  <file.py>   [stdin_file]
 *   node index.js java    <file.java> [stdin_file]
 *   node index.js c       <file.c>    [stdin_file]
 *   node index.js cpp     <file.cpp>  [stdin_file]
 */

const SUPPORTED_LANGUAGES = ['python', 'java', 'c', 'cpp'];

// Lazy-load runners so cold start only loads the requested compiler
const RUNNERS = {
  python: () => require('./compilers/python/runner'),
  java:   () => require('./compilers/java/runner'),
  c:      () => require('./compilers/c_cpp/runner_c'),
  cpp:    () => require('./compilers/c_cpp/runner_cpp'),
};

// ── Lambda handler ─────────────────────────────────────────────────────────

/**
 * AWS Lambda entry point.
 */
exports.handler = async function handler(event) {
  const { language, code, stdin = '', limits = {} } = event || {};

  // Validate
  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Unsupported or missing language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
      })
    };
  }

  if (typeof code !== 'string' || code.trim() === '') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or empty "code" field' })
    };
  }

  try {
    const runner = RUNNERS[language]();
    const result = runner.run({ code, stdin, limits });

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        stdout:   '',
        stderr:   e && e.message ? e.message : String(e),
        exitCode: 1
      })
    };
  }
};

// ── Direct programmatic API ────────────────────────────────────────────────

/**
 * Use directly in Node.js (not Lambda).
 *
 * @param {object} opts
 * @param {string} opts.language - 'python' | 'java' | 'c' | 'cpp'
 * @param {string} opts.code     - Source code
 * @param {string} [opts.stdin]  - Optional stdin
 * @param {object} [opts.limits] - Optional resource limits
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function run(opts) {
  const { language, code, stdin = '', limits = {} } = opts;

  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }

  const runner = RUNNERS[language]();
  return runner.run({ code, stdin, limits });
}

exports.run = run;

// ── CLI entry point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const fs   = require('fs');
  const path = require('path');

  const [,, lang, srcFile, stdinFile] = process.argv;

  if (!lang || !srcFile) {
    console.error('Usage: node index.js <language> <source_file> [stdin_file]');
    console.error('  Languages: python, java, c, cpp');
    process.exit(1);
  }

  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.error(`Unknown language "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  const code  = fs.readFileSync(path.resolve(srcFile), 'utf8');
  const stdin = stdinFile ? fs.readFileSync(path.resolve(stdinFile), 'utf8') : '';

  const result = run({ language: lang, code, stdin });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
