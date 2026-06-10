"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProblems = listProblems;
exports.createProblem = createProblem;
exports.getProblemById = getProblemById;
exports.updateProblem = updateProblem;
exports.deleteProblem = deleteProblem;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listProblems(requesterRole, params) {
    const where = {
        ...(requesterRole === 'student' ? { isPublished: true } : {}),
        ...(params.difficulty ? { difficulty: params.difficulty } : {}),
        ...(params.tags && params.tags.length > 0 ? { tags: { hasEvery: params.tags } } : {}),
        ...(params.search
            ? {
                OR: [
                    { title: { contains: params.search, mode: 'insensitive' } },
                    { description: { contains: params.search, mode: 'insensitive' } }
                ]
            }
            : {})
    };
    const skip = (params.page - 1) * params.limit;
    const [total, items] = await db_1.prisma.$transaction([
        db_1.prisma.problem.count({ where }),
        db_1.prisma.problem.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: params.limit,
            select: {
                id: true,
                title: true,
                difficulty: true,
                tags: true,
                timeLimit: true,
                memoryLimit: true,
                isPublished: true,
                createdAt: true,
                updatedAt: true
            }
        })
    ]);
    return {
        page: params.page,
        limit: params.limit,
        total,
        items
    };
}
async function createProblem(requesterRole, input) {
    if (!['admin', 'faculty', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.problem.create({
        data: {
            title: input.title,
            description: input.description,
            difficulty: input.difficulty,
            tags: input.tags,
            timeLimit: input.timeLimit ?? 5000,
            memoryLimit: input.memoryLimit ?? 128,
            isPublished: input.isPublished ?? false
        },
        select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            tags: true,
            timeLimit: true,
            memoryLimit: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function getProblemById(problemId, requesterRole) {
    const where = requesterRole === 'student'
        ? {
            id: problemId,
            isPublished: true
        }
        : { id: problemId };
    const problem = await db_1.prisma.problem.findFirst({
        where,
        select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            tags: true,
            timeLimit: true,
            memoryLimit: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true,
            testCases: {
                where: requesterRole === 'student' ? { isSample: true } : {},
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    input: true,
                    expected: true,
                    isSample: true,
                    order: true
                }
            }
        }
    });
    if (!problem)
        throw (0, apiError_1.notFound)('Not found');
    return problem;
}
async function updateProblem(problemId, requesterRole, input) {
    if (!['admin', 'faculty', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.problem.update({
        where: { id: problemId },
        data: {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(typeof input.description === 'string' ? { description: input.description } : {}),
            ...(input.difficulty ? { difficulty: input.difficulty } : {}),
            ...(Array.isArray(input.tags) ? { tags: input.tags } : {}),
            ...(typeof input.timeLimit === 'number' ? { timeLimit: input.timeLimit } : {}),
            ...(typeof input.memoryLimit === 'number' ? { memoryLimit: input.memoryLimit } : {}),
            ...(typeof input.isPublished === 'boolean' ? { isPublished: input.isPublished } : {})
        },
        select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            tags: true,
            timeLimit: true,
            memoryLimit: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function deleteProblem(problemId, requesterRole) {
    if (requesterRole !== 'admin')
        throw (0, apiError_1.forbidden)('Forbidden');
    await db_1.prisma.problem.delete({ where: { id: problemId } });
    return { status: 'ok' };
}
