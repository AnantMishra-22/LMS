"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listContests = listContests;
exports.createContest = createContest;
exports.getContestById = getContestById;
exports.updateContest = updateContest;
exports.joinContest = joinContest;
exports.getLeaderboard = getLeaderboard;
exports.addProblemToContest = addProblemToContest;
exports.removeProblemFromContest = removeProblemFromContest;
exports.submitToContest = submitToContest;
exports.getMyContestSubmissions = getMyContestSubmissions;
const db_1 = require("../../config/db");
const redis_1 = require("../../config/redis");
const submissions_queue_1 = require("../../jobs/submissions.queue");
const apiError_1 = require("../../utils/apiError");
async function getAccessibleBatchIds(userId) {
    const enrollments = await db_1.prisma.batchEnrollment.findMany({
        where: { userId },
        select: { batchId: true }
    });
    return enrollments.map((e) => e.batchId);
}
async function listContests(requester) {
    const where = requester.role === 'admin' || requester.role === 'trainer'
        ? {}
        : {
            OR: [
                { isPublic: true },
                {
                    batchId: {
                        in: await getAccessibleBatchIds(requester.id)
                    }
                }
            ]
        };
    const contests = await db_1.prisma.contest.findMany({
        where,
        orderBy: { startTime: 'desc' },
        select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            isPublic: true,
            batchId: true,
            createdAt: true,
            _count: {
                select: {
                    problems: true,
                    entries: true
                }
            }
        }
    });
    return contests.map((contest) => ({
        id: contest.id,
        title: contest.title,
        description: contest.description,
        startTime: contest.startTime,
        endTime: contest.endTime,
        isPublic: contest.isPublic,
        batchId: contest.batchId,
        createdAt: contest.createdAt,
        problemCount: contest._count.problems,
        entryCount: contest._count.entries
    }));
}
async function createContest(requesterRole, input) {
    if (!['admin', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.contest.create({
        data: {
            title: input.title,
            description: input.description ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
            isPublic: input.isPublic ?? false,
            batchId: input.batchId ?? null,
            problems: {
                create: input.problems.map((p) => ({
                    problemId: p.problemId,
                    order: p.order,
                    points: p.points ?? 100
                }))
            }
        },
        select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            isPublic: true,
            batchId: true,
            createdAt: true
        }
    });
}
async function getContestById(contestId, requester) {
    const contest = await db_1.prisma.contest.findUnique({
        where: { id: contestId },
        select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            isPublic: true,
            batchId: true,
            createdAt: true,
            problems: {
                orderBy: { order: 'asc' },
                select: {
                    order: true,
                    points: true,
                    problem: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            difficulty: true,
                            tags: true,
                            timeLimit: true,
                            memoryLimit: true
                        }
                    }
                }
            }
        }
    });
    if (!contest)
        throw (0, apiError_1.notFound)('Not found');
    if (!contest.isPublic && requester.role !== 'admin' && requester.role !== 'trainer') {
        const batchIds = await getAccessibleBatchIds(requester.id);
        if (!contest.batchId || !batchIds.includes(contest.batchId)) {
            throw (0, apiError_1.forbidden)('Forbidden');
        }
    }
    const now = new Date();
    if (requester.role === 'student' && contest.startTime > now) {
        return {
            ...contest,
            problems: []
        };
    }
    return contest;
}
async function updateContest(contestId, requesterRole, input) {
    if (!['admin', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.contest.update({
        where: { id: contestId },
        data: {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(input.description === null || typeof input.description === 'string'
                ? { description: input.description }
                : {}),
            ...(input.startTime instanceof Date ? { startTime: input.startTime } : {}),
            ...(input.endTime instanceof Date ? { endTime: input.endTime } : {}),
            ...(typeof input.isPublic === 'boolean' ? { isPublic: input.isPublic } : {}),
            ...(input.batchId === null || typeof input.batchId === 'string' ? { batchId: input.batchId } : {})
        },
        select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            isPublic: true,
            batchId: true,
            createdAt: true
        }
    });
}
async function joinContest(contestId, requester) {
    if (requester.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const contest = await getContestById(contestId, requester);
    const now = new Date();
    if (contest.endTime < now)
        throw (0, apiError_1.badRequest)('Contest has ended');
    const existing = await db_1.prisma.contestEntry.findUnique({
        where: {
            contestId_userId: {
                contestId,
                userId: requester.id
            }
        },
        select: { id: true }
    });
    if (existing)
        throw (0, apiError_1.conflict)('Already joined');
    const entry = await db_1.prisma.contestEntry.create({
        data: {
            contestId,
            userId: requester.id
        },
        select: {
            id: true,
            contestId: true,
            userId: true,
            score: true,
            joinedAt: true
        }
    });
    const ttlSeconds = Math.max(1, Math.floor((contest.endTime.getTime() - now.getTime()) / 1000));
    await redis_1.redis.setex(`contest:active:${requester.id}`, ttlSeconds, contestId);
    return entry;
}
async function getLeaderboard(contestId, requester) {
    await getContestById(contestId, requester);
    const redisRows = await redis_1.redis.zrevrange(`leaderboard:${contestId}`, 0, -1, 'WITHSCORES');
    const cachedRows = [];
    for (let i = 0; i < redisRows.length; i += 2) {
        cachedRows.push({
            userId: redisRows[i],
            score: Number(redisRows[i + 1] ?? 0)
        });
    }
    const rows = cachedRows.length > 0
        ? cachedRows
        : await db_1.prisma.contestEntry.findMany({
            where: { contestId },
            orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
            select: { userId: true, score: true }
        });
    if (cachedRows.length === 0 && rows.length > 0) {
        const pipeline = redis_1.redis.pipeline();
        for (const row of rows) {
            pipeline.zadd(`leaderboard:${contestId}`, row.score, row.userId);
        }
        await pipeline.exec();
    }
    const [users, acceptedSubmissions] = await Promise.all([
        db_1.prisma.user.findMany({
            where: { id: { in: rows.map((row) => row.userId) } },
            select: { id: true, name: true }
        }),
        db_1.prisma.submission.findMany({
            where: { contestId, verdict: 'accepted' },
            distinct: ['userId', 'problemId'],
            select: { userId: true, problemId: true }
        })
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const solvedByUserId = new Map();
    for (const submission of acceptedSubmissions) {
        solvedByUserId.set(submission.userId, (solvedByUserId.get(submission.userId) ?? 0) + 1);
    }
    return rows.map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        name: usersById.get(row.userId)?.name ?? 'Unknown user',
        score: row.score,
        solvedCount: solvedByUserId.get(row.userId) ?? 0
    }));
}
async function addProblemToContest(contestId, requesterRole, input) {
    if (!['admin', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.contestProblem.create({
        data: {
            contestId,
            problemId: input.problemId,
            points: input.points,
            order: input.order
        },
        select: {
            contestId: true,
            problemId: true,
            points: true,
            order: true
        }
    });
}
async function removeProblemFromContest(contestId, problemId, requesterRole) {
    if (!['admin', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    await db_1.prisma.contestProblem.delete({
        where: {
            contestId_problemId: {
                contestId,
                problemId
            }
        }
    });
    return { status: 'ok' };
}
async function submitToContest(contestId, requester, input) {
    if (requester.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    const contest = await getContestById(contestId, requester);
    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
        throw (0, apiError_1.forbidden)('Contest is not active');
    }
    const [entry, contestProblem] = await Promise.all([
        db_1.prisma.contestEntry.findUnique({
            where: {
                contestId_userId: {
                    contestId,
                    userId: requester.id
                }
            },
            select: { id: true }
        }),
        db_1.prisma.contestProblem.findUnique({
            where: {
                contestId_problemId: {
                    contestId,
                    problemId: input.problemId
                }
            },
            select: { contestId: true }
        })
    ]);
    if (!entry)
        throw (0, apiError_1.forbidden)('Join contest first');
    if (!contestProblem)
        throw (0, apiError_1.notFound)('Not found');
    const totalTests = await db_1.prisma.testCase.count({
        where: { problemId: input.problemId }
    });
    const submission = await db_1.prisma.submission.create({
        data: {
            userId: requester.id,
            contestId,
            problemId: input.problemId,
            language: input.language,
            code: input.code,
            status: 'pending',
            totalTests
        },
        select: { id: true, status: true }
    });
    await (0, submissions_queue_1.enqueueSubmissionJob)({
        submissionId: submission.id,
        userId: requester.id,
        contestId,
        problemId: input.problemId,
        language: input.language,
        code: input.code
    });
    return {
        submissionId: submission.id,
        status: submission.status
    };
}
async function getMyContestSubmissions(contestId, requester) {
    if (requester.role !== 'student')
        throw (0, apiError_1.forbidden)('Forbidden');
    await getContestById(contestId, requester);
    return db_1.prisma.submission.findMany({
        where: {
            contestId,
            userId: requester.id
        },
        orderBy: [{ problemId: 'asc' }, { verdict: 'asc' }, { createdAt: 'desc' }],
        distinct: ['problemId'],
        select: {
            id: true,
            problemId: true,
            status: true,
            verdict: true,
            passedTests: true,
            totalTests: true,
            execTimeMs: true,
            createdAt: true,
            problem: {
                select: { id: true, title: true, difficulty: true }
            }
        }
    });
}
