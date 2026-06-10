"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubmission = createSubmission;
exports.getSubmissionById = getSubmissionById;
exports.listSubmissions = listSubmissions;
exports.getGradingQueue = getGradingQueue;
exports.listPendingSubmissionsForUser = listPendingSubmissionsForUser;
exports.gradeSubmission = gradeSubmission;
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const apiError_1 = require("../../utils/apiError");
const submissions_queue_1 = require("../../jobs/submissions.queue");
async function createSubmission(requester, input) {
    if (!['student', 'faculty', 'trainer'].includes(requester.role))
        throw (0, apiError_1.forbidden)('Forbidden');
    logger_1.logger.info({
        userId: requester.id,
        problemId: input.problemId,
        language: input.language,
        codeLength: input.code.length
    }, 'Submission API called');
    const codeBytes = Buffer.byteLength(input.code, 'utf8');
    if (codeBytes > env_1.env.SUBMISSION_CODE_MAX_BYTES) {
        throw (0, apiError_1.badRequest)(`Code exceeds max size (${env_1.env.SUBMISSION_CODE_MAX_BYTES} bytes)`);
    }
    const problem = await db_1.prisma.problem.findFirst({
        where: {
            id: input.problemId,
            isPublished: true
        },
        select: { id: true, timeLimit: true, memoryLimit: true }
    });
    if (!problem)
        throw (0, apiError_1.notFound)('Not found');
    if (input.contestId) {
        const now = new Date();
        const contest = await db_1.prisma.contest.findUnique({
            where: { id: input.contestId },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                problems: {
                    where: { problemId: input.problemId },
                    select: { problemId: true }
                },
                entries: {
                    where: { userId: requester.id },
                    select: { userId: true }
                }
            }
        });
        if (!contest)
            throw (0, apiError_1.notFound)('Not found');
        if (contest.startTime > now || contest.endTime < now)
            throw (0, apiError_1.badRequest)('Contest is not active');
        if (contest.problems.length === 0)
            throw (0, apiError_1.badRequest)('Problem is not in this contest');
        if (contest.entries.length === 0)
            throw (0, apiError_1.forbidden)('Join contest first');
    }
    const totalTests = await db_1.prisma.testCase.count({
        where: {
            problemId: input.problemId
        }
    });
    logger_1.logger.info({ userId: requester.id, problemId: input.problemId, totalTests }, 'Creating submission DB record');
    const submission = await db_1.prisma.submission.create({
        data: {
            userId: requester.id,
            problemId: input.problemId,
            contestId: input.contestId,
            language: input.language,
            code: input.code,
            status: 'pending',
            totalTests
        },
        select: {
            id: true,
            status: true
        }
    });
    logger_1.logger.info({ submissionId: submission.id, totalTests }, 'Submission created, enqueueing through QStash');
    await (0, submissions_queue_1.enqueueSubmissionJob)({
        submissionId: submission.id,
        userId: requester.id,
        problemId: input.problemId,
        language: input.language,
        code: input.code,
        ...(input.contestId ? { contestId: input.contestId } : {})
    });
    logger_1.logger.info({ submissionId: submission.id }, 'Submission enqueued successfully - waiting for QStash worker callback');
    return {
        submissionId: submission.id,
        status: submission.status
    };
}
async function getSubmissionById(requester, submissionId) {
    const submission = await db_1.prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
            id: true,
            userId: true,
            problemId: true,
            language: true,
            code: true,
            status: true,
            verdict: true,
            stdout: true,
            stderr: true,
            passedTests: true,
            totalTests: true,
            execTimeMs: true,
            memoryKb: true,
            createdAt: true,
            problem: {
                select: {
                    id: true,
                    title: true,
                    difficulty: true
                }
            }
        }
    });
    if (!submission)
        throw (0, apiError_1.notFound)('Not found');
    if (requester.role === 'student' && submission.userId !== requester.id) {
        throw (0, apiError_1.forbidden)('Forbidden');
    }
    return submission;
}
async function listSubmissions(requester, params) {
    const where = {
        ...(requester.role === 'student' ? { userId: requester.id } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.problemId ? { problemId: params.problemId } : {}),
        ...(params.contestId ? { contestId: params.contestId } : {})
    };
    const skip = (params.page - 1) * params.limit;
    const [total, items] = await db_1.prisma.$transaction([
        db_1.prisma.submission.count({ where }),
        db_1.prisma.submission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: params.limit,
            select: {
                id: true,
                userId: true,
                problemId: true,
                contestId: true,
                language: true,
                status: true,
                verdict: true,
                passedTests: true,
                totalTests: true,
                execTimeMs: true,
                createdAt: true,
                problem: {
                    select: { id: true, title: true, difficulty: true }
                },
                user: requester.role === 'student'
                    ? false
                    : {
                        select: { id: true, name: true, email: true }
                    }
            }
        })
    ]);
    return { page: params.page, limit: params.limit, total, items };
}
async function getGradingQueue() {
    return db_1.prisma.submission.findMany({
        where: {
            status: 'completed',
            score: null
        },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            userId: true,
            problemId: true,
            contestId: true,
            language: true,
            status: true,
            verdict: true,
            passedTests: true,
            totalTests: true,
            execTimeMs: true,
            score: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
            problem: { select: { id: true, title: true, difficulty: true } }
        }
    });
}
async function listPendingSubmissionsForUser(requester) {
    const where = {
        ...(requester.role === 'student' ? { userId: requester.id } : {}),
        status: { in: ['pending', 'running'] }
    };
    const items = await db_1.prisma.submission.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            userId: true,
            problemId: true,
            contestId: true,
            language: true,
            status: true,
            verdict: true,
            passedTests: true,
            totalTests: true,
            execTimeMs: true,
            createdAt: true,
            problem: { select: { id: true, title: true, difficulty: true } }
        }
    });
    return items;
}
async function gradeSubmission(id, input, graderId) {
    return db_1.prisma.submission.update({
        where: { id },
        data: {
            verdict: input.verdict,
            score: input.score,
            gradedBy: graderId,
            gradedAt: new Date()
        },
        select: {
            id: true,
            status: true,
            verdict: true,
            score: true,
            gradedBy: true,
            gradedAt: true
        }
    });
}
