"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCourses = listCourses;
exports.createCourse = createCourse;
exports.getCourseById = getCourseById;
exports.updateCourse = updateCourse;
exports.deleteCourse = deleteCourse;
const db_1 = require("../../config/db");
const apiError_1 = require("../../utils/apiError");
async function listCourses(requesterRole) {
    const where = requesterRole === 'student' ? { isPublished: true } : {};
    const items = await db_1.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true
        }
    });
    return items;
}
async function createCourse(input) {
    return db_1.prisma.course.create({
        data: {
            title: input.title,
            description: input.description ?? null,
            thumbnailUrl: input.thumbnailUrl ?? null
        },
        select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function getCourseById(courseId, requesterRole) {
    const where = requesterRole === 'student'
        ? {
            id: courseId,
            isPublished: true
        }
        : { id: courseId };
    const course = await db_1.prisma.course.findFirst({
        where,
        select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true,
            modules: {
                where: requesterRole === 'student' ? { isPublished: true } : {},
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    title: true,
                    order: true,
                    duration: true,
                    isPublished: true,
                    createdAt: true
                }
            }
        }
    });
    if (!course)
        throw (0, apiError_1.notFound)('Not found');
    return course;
}
async function updateCourse(courseId, requesterRole, input) {
    if (!['admin', 'faculty'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    return db_1.prisma.course.update({
        where: { id: courseId },
        data: {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(input.description === null || typeof input.description === 'string'
                ? { description: input.description }
                : {}),
            ...(input.thumbnailUrl === null || typeof input.thumbnailUrl === 'string'
                ? { thumbnailUrl: input.thumbnailUrl }
                : {}),
            ...(typeof input.isPublished === 'boolean' ? { isPublished: input.isPublished } : {})
        },
        select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true
        }
    });
}
async function deleteCourse(courseId, requesterRole) {
    if (requesterRole !== 'admin')
        throw (0, apiError_1.forbidden)('Forbidden');
    const linked = await db_1.prisma.batchCourse.count({
        where: { courseId }
    });
    if (linked > 0) {
        throw (0, apiError_1.forbidden)('Course has active enrollments');
    }
    await db_1.prisma.course.delete({ where: { id: courseId } });
    return { status: 'ok' };
}
