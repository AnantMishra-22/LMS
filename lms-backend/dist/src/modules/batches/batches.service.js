"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBatches = listBatches;
exports.createBatch = createBatch;
exports.getBatchById = getBatchById;
exports.updateBatch = updateBatch;
exports.deleteBatch = deleteBatch;
exports.listBatchStudents = listBatchStudents;
exports.enrollUser = enrollUser;
exports.unenrollUser = unenrollUser;
exports.listBatchCourses = listBatchCourses;
exports.addCourseToBatch = addCourseToBatch;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function ensureBatchAccess(batchId, requester) {
    if (requester.role === 'admin')
        return;
    const enrollment = await db_1.prisma.batchEnrollment.findUnique({
        where: {
            batchId_userId: {
                batchId,
                userId: requester.id
            }
        },
        select: { id: true }
    });
    if (!enrollment)
        throw (0, apiError_1.forbidden)('Forbidden');
}
async function listBatches(requester) {
    if (requester.role === 'admin') {
        return db_1.prisma.batch.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                institutionId: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true
            }
        });
    }
    const enrollments = await db_1.prisma.batchEnrollment.findMany({
        where: {
            userId: requester.id
        },
        orderBy: { joinedAt: 'desc' },
        select: {
            batch: {
                select: {
                    id: true,
                    name: true,
                    institutionId: true,
                    startDate: true,
                    endDate: true,
                    createdAt: true,
                    updatedAt: true
                }
            }
        }
    });
    return enrollments.map((e) => e.batch);
}
async function createBatch(input) {
    return db_1.prisma.batch.create({
        data: {
            name: input.name,
            institutionId: input.institutionId,
            startDate: input.startDate ?? null,
            endDate: input.endDate ?? null
        },
        select: {
            id: true,
            name: true,
            institutionId: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function getBatchById(batchId, requester) {
    await ensureBatchAccess(batchId, requester);
    const batch = await db_1.prisma.batch.findUnique({
        where: { id: batchId },
        select: {
            id: true,
            name: true,
            institutionId: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: { enrollments: true }
            }
        }
    });
    if (!batch)
        throw (0, apiError_1.notFound)('Not found');
    return {
        ...batch,
        enrolledCount: batch._count.enrollments
    };
}
async function updateBatch(batchId, input) {
    return db_1.prisma.batch.update({
        where: { id: batchId },
        data: {
            ...(typeof input.name === 'string' ? { name: input.name } : {}),
            ...(input.institutionId === null || typeof input.institutionId === 'string'
                ? { institutionId: input.institutionId }
                : {}),
            ...(input.startDate === null || input.startDate instanceof Date
                ? { startDate: input.startDate }
                : {}),
            ...(input.endDate === null || input.endDate instanceof Date ? { endDate: input.endDate } : {})
        },
        select: {
            id: true,
            name: true,
            institutionId: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function deleteBatch(batchId) {
    await db_1.prisma.batch.delete({ where: { id: batchId } });
    return { status: 'ok' };
}
async function listBatchStudents(batchId, requester) {
    await ensureBatchAccess(batchId, requester);
    const students = await db_1.prisma.batchEnrollment.findMany({
        where: {
            batchId,
            role: 'student'
        },
        orderBy: { joinedAt: 'desc' },
        select: {
            joinedAt: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    avatarUrl: true,
                    isActive: true
                }
            }
        }
    });
    return students;
}
async function enrollUser(batchId, input) {
    // Ensure batch exists
    const batch = await db_1.prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } });
    if (!batch)
        throw (0, apiError_1.notFound)('Not found');
    const user = await db_1.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.batchEnrollment.upsert({
        where: {
            batchId_userId: {
                batchId,
                userId: input.userId
            }
        },
        create: {
            batchId,
            userId: input.userId,
            role: input.role
        },
        update: {
            role: input.role
        },
        select: {
            id: true,
            batchId: true,
            userId: true,
            role: true,
            joinedAt: true
        }
    });
}
async function unenrollUser(batchId, userId) {
    await db_1.prisma.batchEnrollment.deleteMany({
        where: { batchId, userId }
    });
    return { status: 'ok' };
}
async function listBatchCourses(batchId, requester) {
    await ensureBatchAccess(batchId, requester);
    const items = await db_1.prisma.batchCourse.findMany({
        where: {
            batchId,
            ...(requester.role === 'student' ? { course: { isPublished: true } } : {})
        },
        orderBy: { course: { createdAt: 'desc' } },
        select: {
            course: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    thumbnailUrl: true,
                    isPublished: true,
                    createdAt: true,
                    updatedAt: true
                }
            }
        }
    });
    return items.map((i) => i.course);
}
async function addCourseToBatch(batchId, requester, courseId) {
    if (!['admin', 'faculty'].includes(requester.role))
        throw (0, apiError_1.forbidden)('Forbidden');
    await ensureBatchAccess(batchId, requester);
    const batch = await db_1.prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } });
    if (!batch)
        throw (0, apiError_1.notFound)('Not found');
    const course = await db_1.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course)
        throw (0, apiError_1.notFound)('Not found');
    await db_1.prisma.batchCourse.create({
        data: {
            batchId,
            courseId
        }
    });
    return { status: 'ok' };
}
