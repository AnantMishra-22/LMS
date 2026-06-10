"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSubmission = processSubmission;
const axios_1 = __importDefault(require("axios"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const httpAgent = new node_http_1.default.Agent({ keepAlive: true });
const httpsAgent = new node_https_1.default.Agent({ keepAlive: true });
function normalizeOutput(value) {
    return value.replace(/\r\n/g, '\n').trimEnd();
}
function truncateOutput(value, maxBytes) {
    const buf = Buffer.from(value, 'utf8');
    if (buf.length <= maxBytes) {
        return { value, bytes: buf.length, truncated: false };
    }
    return {
        value: buf.subarray(0, maxBytes).toString('utf8'),
        bytes: buf.length,
        truncated: true
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function validateCompilerResponse(data) {
    if (!data || typeof data !== 'object')
        return false;
    const obj = data;
    return (typeof obj.stdout === 'string' &&
        typeof obj.stderr === 'string' &&
        (obj.exitCode === null || typeof obj.exitCode === 'number') &&
        typeof obj.verdict === 'string' &&
        typeof obj.execTimeMs === 'number');
}
function mapCompilerVerdict(verdict) {
    if (verdict === 'tle')
        return 'time_limit_exceeded';
    if (verdict === 'mle')
        return 'memory_limit_exceeded';
    if (verdict === 'ce')
        return 'compilation_error';
    if (verdict === 'rte')
        return 'runtime_error';
    return 'accepted';
}
async function runSingleTest(params) {
    let lastError;
    const hardTimeout = env_1.env.COMPILER_TIMEOUT_MS + 3_000; // 3s buffer
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            logger_1.logger.debug({
                submissionId: params.submissionId,
                testCaseIndex: params.testCaseIndex,
                attempt
            }, 'Calling compiler service');
            // Use AbortController for hard timeout
            const controller = new AbortController();
            const timeoutHandle = setTimeout(() => {
                controller.abort();
            }, hardTimeout);
            try {
                const res = await axios_1.default.post(`${env_1.env.COMPILER_SERVICE_URL}/execute`, {
                    language: params.language,
                    code: params.code,
                    stdin: params.stdin,
                    timeoutMs: params.timeoutMs,
                    memoryMb: params.memoryMb
                }, {
                    timeout: hardTimeout,
                    signal: controller.signal,
                    httpAgent,
                    httpsAgent
                });
                clearTimeout(timeoutHandle);
                // Validate response shape
                if (!validateCompilerResponse(res.data)) {
                    logger_1.logger.error({
                        submissionId: params.submissionId,
                        testCaseIndex: params.testCaseIndex,
                        receivedData: res.data
                    }, 'Compiler response has invalid shape');
                    throw new Error('Invalid compiler response format');
                }
                logger_1.logger.debug({
                    submissionId: params.submissionId,
                    testCaseIndex: params.testCaseIndex,
                    verdict: res.data.verdict,
                    execTimeMs: res.data.execTimeMs,
                    attempt
                }, 'Compiler call succeeded');
                return res.data;
            }
            finally {
                clearTimeout(timeoutHandle);
            }
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            const isTimeout = lastError.message.includes('ECONNABORTED') || lastError.message.includes('timeout');
            const isNetworkError = lastError.message.includes('ECONNREFUSED') ||
                lastError.message.includes('ETIMEDOUT') ||
                lastError.message.includes('socket');
            if (axios_1.default.isAxiosError(err)) {
                logger_1.logger.warn({
                    submissionId: params.submissionId,
                    testCaseIndex: params.testCaseIndex,
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    message: err.message,
                    code: err.code,
                    isTimeout,
                    isNetworkError,
                    attempt,
                    compilerUrl: env_1.env.COMPILER_SERVICE_URL
                }, 'Compiler service call failed');
            }
            else {
                logger_1.logger.warn({
                    submissionId: params.submissionId,
                    testCaseIndex: params.testCaseIndex,
                    message: lastError.message,
                    isTimeout,
                    isNetworkError,
                    attempt
                }, 'Compiler call error');
            }
            // Retry on network/timeout errors
            if ((isNetworkError || isTimeout) && attempt < 2) {
                const backoffMs = attempt * 1000;
                logger_1.logger.info({
                    submissionId: params.submissionId,
                    testCaseIndex: params.testCaseIndex,
                    backoffMs
                }, 'Retrying compiler call');
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                continue;
            }
            // Final attempt failed
            break;
        }
    }
    logger_1.logger.error({
        submissionId: params.submissionId,
        testCaseIndex: params.testCaseIndex,
        error: lastError?.message,
        compilerUrl: env_1.env.COMPILER_SERVICE_URL
    }, 'Compiler service unavailable after retries');
    throw lastError || new Error('Compiler service failed');
}
async function updateContestScore(job) {
    if (!job.contestId)
        return;
    try {
        const previousAccepted = await db_1.prisma.submission.findFirst({
            where: {
                id: { not: job.submissionId },
                contestId: job.contestId,
                problemId: job.problemId,
                userId: job.userId,
                verdict: 'accepted'
            },
            select: { id: true }
        });
        if (previousAccepted)
            return;
        const contestProblem = await db_1.prisma.contestProblem.findUnique({
            where: {
                contestId_problemId: {
                    contestId: job.contestId,
                    problemId: job.problemId
                }
            },
            select: { points: true }
        });
        const points = contestProblem?.points ?? 100;
        await db_1.prisma.$transaction([
            db_1.prisma.contestEntry.upsert({
                where: {
                    contestId_userId: {
                        contestId: job.contestId,
                        userId: job.userId
                    }
                },
                create: {
                    contestId: job.contestId,
                    userId: job.userId,
                    score: points
                },
                update: {
                    score: { increment: points }
                }
            })
        ]);
        await redis_1.redis.zincrby(`leaderboard:${job.contestId}`, points, job.userId);
        logger_1.logger.info({ submissionId: job.submissionId, contestId: job.contestId, points }, 'Contest score updated');
    }
    catch (err) {
        logger_1.logger.error({ err, submissionId: job.submissionId }, 'Failed to update contest score');
    }
}
async function processSubmission(job) {
    logger_1.logger.info({
        submissionId: job.submissionId,
        userId: job.userId,
        problemId: job.problemId,
        language: job.language
    }, 'Starting submission processing');
    let submission = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
        submission = await db_1.prisma.submission.findUnique({
            where: { id: job.submissionId },
            include: {
                problem: {
                    include: {
                        testCases: {
                            orderBy: { order: 'asc' },
                            select: {
                                id: true,
                                order: true,
                                input: true,
                                expected: true
                            }
                        }
                    }
                }
            }
        });
        if (submission)
            break;
        if (attempt < 5) {
            logger_1.logger.warn({ submissionId: job.submissionId, attempt }, 'Submission not visible yet; retrying lookup');
            await sleep(250);
        }
    }
    if (!submission) {
        logger_1.logger.warn({ submissionId: job.submissionId }, 'Submission not found during processing');
        return;
    }
    if (submission.status !== 'pending') {
        logger_1.logger.info({ submissionId: job.submissionId, status: submission.status }, 'Submission is no longer pending; skipping');
        return;
    }
    const testCases = submission.problem.testCases;
    logger_1.logger.info({ submissionId: job.submissionId, totalTests: testCases.length }, 'Processing submission with test cases');
    await db_1.prisma.submission.update({
        where: { id: job.submissionId },
        data: {
            status: 'running',
            totalTests: testCases.length
        }
    });
    let passed = 0;
    let verdict = 'accepted';
    let stdout = null;
    let stderr = null;
    let execTimeMs = 0;
    try {
        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            logger_1.logger.debug({ submissionId: job.submissionId, testCaseIndex: i + 1, total: testCases.length }, 'Running test case');
            const result = await runSingleTest({
                submissionId: job.submissionId,
                testCaseIndex: i,
                language: submission.language,
                code: submission.code,
                stdin: tc.input,
                timeoutMs: submission.problem.timeLimit,
                memoryMb: submission.problem.memoryLimit
            });
            execTimeMs += result.execTimeMs;
            const outputLimitBytes = env_1.env.COMPILER_MAX_OUTPUT_BYTES;
            const stdoutSafe = truncateOutput(result.stdout, outputLimitBytes);
            const stderrSafe = truncateOutput(result.stderr, outputLimitBytes);
            const outputTruncated = Boolean(result.outputTruncated) || stdoutSafe.truncated || stderrSafe.truncated;
            stdout = stdoutSafe.value;
            stderr = stderrSafe.value;
            if (outputTruncated && result.verdict === 'ok') {
                verdict = 'runtime_error';
                stderr = stderr || `Output limit exceeded (${outputLimitBytes} bytes)`;
                logger_1.logger.info({
                    submissionId: job.submissionId,
                    testCaseIndex: i,
                    outputTruncated,
                    stdoutBytes: stdoutSafe.bytes,
                    stderrBytes: stderrSafe.bytes
                }, 'Test case failed (output limit exceeded)');
                break;
            }
            if (result.verdict !== 'ok') {
                verdict = mapCompilerVerdict(result.verdict);
                logger_1.logger.info({
                    submissionId: job.submissionId,
                    testCaseIndex: i,
                    verdict: result.verdict
                }, 'Test case failed (compiler verdict)');
                break;
            }
            const actual = normalizeOutput(result.stdout);
            const expected = normalizeOutput(tc.expected);
            if (actual !== expected) {
                verdict = 'wrong_answer';
                logger_1.logger.info({
                    submissionId: job.submissionId,
                    testCaseIndex: i,
                    expectedLength: expected.length,
                    actualLength: actual.length
                }, 'Test case failed (output mismatch)');
                break;
            }
            passed += 1;
            logger_1.logger.debug({ submissionId: job.submissionId, testCaseIndex: i, passed }, 'Test case passed');
        }
        if (passed !== testCases.length && verdict === 'accepted') {
            verdict = 'wrong_answer';
        }
        logger_1.logger.info({
            submissionId: job.submissionId,
            verdict,
            passed,
            total: testCases.length,
            execTimeMs
        }, 'Submission evaluation complete');
        await db_1.prisma.submission.update({
            where: { id: job.submissionId },
            data: {
                status: 'completed',
                verdict,
                passedTests: passed,
                totalTests: testCases.length,
                stdout,
                stderr,
                execTimeMs
            }
        });
        if (verdict === 'accepted') {
            await updateContestScore(job);
        }
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Worker processing error';
        // Check if it's a compiler service error
        const isCompilerDown = errorMsg.includes('ECONNREFUSED') ||
            errorMsg.includes('Compiler service unavailable') ||
            errorMsg.includes('ETIMEDOUT');
        logger_1.logger.error({
            err,
            submissionId: job.submissionId,
            isCompilerDown,
            testCasesProcessed: passed
        }, isCompilerDown ? 'Compiler service unavailable' : 'Submission processing failed');
        // Mark submission as completed with error, not failed
        // This prevents it from being retried indefinitely
        await db_1.prisma.submission.update({
            where: { id: job.submissionId },
            data: {
                status: 'completed',
                verdict: 'runtime_error',
                passedTests: passed,
                totalTests: testCases.length,
                stderr: isCompilerDown
                    ? 'Compiler service unavailable - please try again later'
                    : errorMsg
            }
        });
        // Log but don't throw - submission is marked completed
        if (!isCompilerDown) {
            throw err;
        }
    }
}
