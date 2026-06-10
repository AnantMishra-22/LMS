"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTestCases = listTestCases;
exports.createTestCase = createTestCase;
exports.updateTestCase = updateTestCase;
exports.deleteTestCase = deleteTestCase;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listTestCases(problemId, requesterRole) {
    if (!['admin', 'faculty', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const problem = await db_1.prisma.problem.findUnique({ where: { id: problemId }, select: { id: true } });
    if (!problem)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.testCase.findMany({
        where: { problemId },
        orderBy: { order: 'asc' },
        select: {
            id: true,
            problemId: true,
            input: true,
            expected: true,
            isSample: true,
            order: true
        }
    });
}
async function createTestCase(problemId, requesterRole, input) {
    if (!['admin', 'faculty', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const problem = await db_1.prisma.problem.findUnique({ where: { id: problemId }, select: { id: true } });
    if (!problem)
        throw (0, apiError_1.notFound)('Not found');
    const order = typeof input.order === 'number'
        ? input.order
        : (await db_1.prisma.testCase.count({ where: { problemId } })) + 1;
    return db_1.prisma.testCase.create({
        data: {
            problemId,
            input: input.input,
            expected: input.expected,
            isSample: input.isSample ?? false,
            order
        },
        select: {
            id: true,
            problemId: true,
            input: true,
            expected: true,
            isSample: true,
            order: true
        }
    });
}
async function updateTestCase(problemId, caseId, requesterRole, input) {
    if (!['admin', 'faculty', 'trainer'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const existing = await db_1.prisma.testCase.findFirst({
        where: { id: caseId, problemId },
        select: { id: true }
    });
    if (!existing)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.testCase.update({
        where: { id: caseId },
        data: {
            ...(typeof input.input === 'string' ? { input: input.input } : {}),
            ...(typeof input.expected === 'string' ? { expected: input.expected } : {}),
            ...(typeof input.isSample === 'boolean' ? { isSample: input.isSample } : {}),
            ...(typeof input.order === 'number' ? { order: input.order } : {})
        },
        select: {
            id: true,
            problemId: true,
            input: true,
            expected: true,
            isSample: true,
            order: true
        }
    });
}
async function deleteTestCase(problemId, caseId, requesterRole) {
    if (requesterRole !== 'admin')
        throw (0, apiError_1.forbidden)('Forbidden');
    const existing = await db_1.prisma.testCase.findFirst({
        where: { id: caseId, problemId },
        select: { id: true }
    });
    if (!existing)
        throw (0, apiError_1.notFound)('Not found');
    await db_1.prisma.testCase.delete({ where: { id: caseId } });
    return { status: 'ok' };
}
