"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTests = listTests;
exports.createTest = createTest;
exports.getTestById = getTestById;
exports.updateTest = updateTest;
exports.addQuestion = addQuestion;
exports.startAttempt = startAttempt;
exports.getActiveAttempt = getActiveAttempt;
exports.submitAttempt = submitAttempt;
exports.getTestResults = getTestResults;
exports.getMonitoring = getMonitoring;
exports.getMyResult = getMyResult;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function ensureBatchAccess(user, batchId) {
    if (user.role === 'admin' || user.role === 'trainer' || user.role === 'faculty')
        return;
    const enrollment = await db_1.prisma.batchEnrollment.findUnique({
        where: { batchId_userId: { batchId, userId: user.id } },
        select: { id: true }
    });
    if (!enrollment)
        throw (0, apiError_1.forbidden)('Forbidden');
}
async function listTests(user) {
    const now = new Date();
    const batchIds = user.role === 'student'
        ? (await db_1.prisma.batchEnrollment.findMany({
            where: { userId: user.id },
            select: { batchId: true }
        })).map((item) => item.batchId)
        : undefined;
    return db_1.prisma.test.findMany({
        where: user.role === 'student'
            ? {
                batchId: { in: batchIds ?? [] },
                OR: [{ startTime: null }, { startTime: { lte: now } }]
            }
            : {},
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            batchId: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            createdAt: true,
            _count: { select: { questions: true, attempts: true } }
        }
    });
}
async function createTest(input) {
    return db_1.prisma.test.create({
        data: {
            batchId: input.batchId,
            title: input.title,
            description: input.description ?? null,
            startTime: input.startTime ?? null,
            endTime: input.endTime ?? null,
            durationSeconds: input.durationSeconds ?? null,
            questions: {
                create: input.questions.map((question) => ({
                    text: question.text,
                    options: question.options,
                    answer: question.answer,
                    points: question.points,
                    order: question.order
                }))
            }
        },
        select: {
            id: true,
            batchId: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            createdAt: true
        }
    });
}
async function getTestById(testId, user) {
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: {
            id: true,
            batchId: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            createdAt: true,
            questions: {
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    text: true,
                    options: true,
                    answer: true,
                    points: true,
                    order: true
                }
            }
        }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    await ensureBatchAccess(user, test.batchId);
    const now = new Date();
    if (user.role === 'student' && test.startTime && test.startTime > now) {
        throw (0, apiError_1.forbidden)('Test has not started');
    }
    if (user.role !== 'student')
        return test;
    return {
        ...test,
        questions: test.questions.map(({ answer: _answer, ...question }) => question)
    };
}
async function updateTest(testId, input) {
    return db_1.prisma.test.update({
        where: { id: testId },
        data: {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(input.description === null || typeof input.description === 'string'
                ? { description: input.description }
                : {}),
            ...(input.startTime === null || input.startTime instanceof Date ? { startTime: input.startTime } : {}),
            ...(input.endTime === null || input.endTime instanceof Date ? { endTime: input.endTime } : {}),
            ...(input.durationSeconds === null || typeof input.durationSeconds === 'number' ? { durationSeconds: input.durationSeconds } : {})
        },
        select: {
            id: true,
            batchId: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            createdAt: true
        }
    });
}
async function addQuestion(testId, question) {
    const test = await db_1.prisma.test.findUnique({ where: { id: testId }, select: { id: true } });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.testQuestion.create({
        data: {
            testId,
            text: question.text,
            options: question.options,
            answer: question.answer,
            points: question.points,
            order: question.order
        },
        select: {
            id: true,
            testId: true,
            text: true,
            options: true,
            answer: true,
            points: true,
            order: true
        }
    });
}
const DEFAULT_TEST_DURATION_SECONDS = 60 * 60;
function addSeconds(date, seconds) {
    return new Date(date.getTime() + seconds * 1000);
}
function attemptPayload(attempt, serverNow = new Date()) {
    return {
        ...attempt,
        serverNow
    };
}
async function expireAttempt(attemptId) {
    return db_1.prisma.testAttempt.update({
        where: { id: attemptId },
        data: { status: 'expired' },
        select: {
            id: true,
            testId: true,
            userId: true,
            startedAt: true,
            expiresAt: true,
            durationSeconds: true,
            status: true,
            submittedAt: true
        }
    });
}
async function startAttempt(testId, user) {
    if (user.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: {
            id: true,
            batchId: true,
            startTime: true,
            endTime: true,
            durationSeconds: true
        }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    await ensureBatchAccess(user, test.batchId);
    const now = new Date();
    if (test.startTime && test.startTime > now)
        throw (0, apiError_1.badRequest)('Test has not started');
    if (test.endTime && test.endTime < now)
        throw (0, apiError_1.badRequest)('Test has ended');
    const existing = await db_1.prisma.testAttempt.findUnique({
        where: { testId_userId: { testId, userId: user.id } },
        select: {
            id: true,
            testId: true,
            userId: true,
            startedAt: true,
            expiresAt: true,
            durationSeconds: true,
            status: true,
            submittedAt: true
        }
    });
    if (existing) {
        if (existing.status === 'active' && existing.expiresAt <= now) {
            await expireAttempt(existing.id);
            throw (0, apiError_1.badRequest)('Attempt has expired');
        }
        if (existing.status === 'active')
            return attemptPayload(existing, now);
        throw (0, apiError_1.conflict)('Attempt already completed');
    }
    const durationSeconds = test.durationSeconds ?? DEFAULT_TEST_DURATION_SECONDS;
    const policyExpiresAt = addSeconds(now, durationSeconds);
    const expiresAt = test.endTime && test.endTime < policyExpiresAt ? test.endTime : policyExpiresAt;
    const attempt = await db_1.prisma.testAttempt.create({
        data: {
            testId,
            userId: user.id,
            answers: {},
            startedAt: now,
            expiresAt,
            durationSeconds,
            status: 'active'
        },
        select: {
            id: true,
            testId: true,
            userId: true,
            startedAt: true,
            expiresAt: true,
            durationSeconds: true,
            status: true,
            submittedAt: true
        }
    });
    return attemptPayload(attempt, now);
}
async function getActiveAttempt(testId, user) {
    if (user.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: { id: true, batchId: true }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    await ensureBatchAccess(user, test.batchId);
    const attempt = await db_1.prisma.testAttempt.findUnique({
        where: { testId_userId: { testId, userId: user.id } },
        select: {
            id: true,
            testId: true,
            userId: true,
            startedAt: true,
            expiresAt: true,
            durationSeconds: true,
            status: true,
            submittedAt: true
        }
    });
    if (!attempt)
        throw (0, apiError_1.notFound)('Not found');
    const now = new Date();
    if (attempt.status === 'active' && attempt.expiresAt <= now) {
        const expired = await expireAttempt(attempt.id);
        return attemptPayload(expired, now);
    }
    return attemptPayload(attempt, now);
}
async function submitAttempt(testId, user, answers) {
    if (user.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: {
            id: true,
            batchId: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            questions: {
                select: { id: true, answer: true, points: true }
            }
        }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    await ensureBatchAccess(user, test.batchId);
    const now = new Date();
    if (test.startTime && test.startTime > now)
        throw (0, apiError_1.badRequest)('Test has not started');
    if (test.endTime && test.endTime < now)
        throw (0, apiError_1.badRequest)('Test has ended');
    const existing = await db_1.prisma.testAttempt.findUnique({
        where: { testId_userId: { testId, userId: user.id } },
        select: { id: true, submittedAt: true, status: true, expiresAt: true }
    });
    if (existing?.submittedAt)
        throw (0, apiError_1.conflict)('Attempt already submitted');
    if (!existing)
        throw (0, apiError_1.badRequest)('Start attempt before submitting');
    if (existing.status !== 'active')
        throw (0, apiError_1.badRequest)('Attempt is not active');
    if (existing.expiresAt <= now) {
        await expireAttempt(existing.id);
        throw (0, apiError_1.badRequest)('Attempt has expired');
    }
    let score = 0;
    let correctCount = 0;
    let maxScore = 0;
    for (const question of test.questions) {
        maxScore += question.points;
        if (answers[question.id] === question.answer) {
            score += question.points;
            correctCount += 1;
        }
    }
    await db_1.prisma.testAttempt.update({
        where: { testId_userId: { testId, userId: user.id } },
        data: {
            answers,
            score,
            submittedAt: now,
            status: 'submitted'
        }
    });
    return {
        score,
        maxScore,
        correctCount,
        totalCount: test.questions.length
    };
}
async function getTestResults(testId) {
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: { id: true, questions: { select: { points: true } } }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    const attempts = await db_1.prisma.testAttempt.findMany({
        where: { testId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        select: {
            userId: true,
            score: true,
            submittedAt: true,
            user: { select: { id: true, name: true, email: true } }
        }
    });
    const maxScore = test.questions.reduce((sum, question) => sum + question.points, 0);
    const scores = attempts.map((attempt) => attempt.score ?? 0);
    const avgScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const passRate = scores.length ? scores.filter((score) => score >= maxScore * 0.5).length / scores.length : 0;
    return {
        attempts,
        aggregate: {
            avgScore,
            maxScore,
            passRate
        }
    };
}
async function getMonitoring(testId) {
    const test = await db_1.prisma.test.findUnique({ where: { id: testId }, select: { id: true } });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.testAttempt.findMany({
        where: { testId },
        orderBy: { startedAt: 'desc' },
        select: {
            id: true,
            userId: true,
            score: true,
            startedAt: true,
            submittedAt: true,
            user: { select: { id: true, name: true, email: true } }
        }
    });
}
async function getMyResult(testId, user) {
    if (user.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const test = await db_1.prisma.test.findUnique({
        where: { id: testId },
        select: {
            id: true,
            endTime: true,
            questions: {
                orderBy: { order: 'asc' },
                select: { id: true, text: true, options: true, answer: true, points: true, order: true }
            },
            attempts: {
                where: { userId: user.id },
                select: { answers: true, score: true, submittedAt: true }
            }
        }
    });
    if (!test)
        throw (0, apiError_1.notFound)('Not found');
    const attempt = test.attempts[0];
    if (!attempt)
        throw (0, apiError_1.notFound)('Not found');
    const answers = attempt.answers;
    const showCorrect = Boolean(test.endTime && test.endTime < new Date());
    return {
        score: attempt.score,
        submittedAt: attempt.submittedAt,
        questions: test.questions.map((question) => ({
            id: question.id,
            text: question.text,
            options: question.options,
            selected: answers[question.id] ?? null,
            isCorrect: answers[question.id] === question.answer,
            points: question.points,
            ...(showCorrect ? { answer: question.answer } : {})
        }))
    };
}
