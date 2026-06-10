"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listModules = listModules;
exports.createModule = createModule;
exports.getModule = getModule;
exports.updateModule = updateModule;
exports.deleteModule = deleteModule;
exports.presignModuleVideoUpload = presignModuleVideoUpload;
const uuid_1 = require("uuid");
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const apiError_1 = require("../../utils/apiError");
const s3_1 = require("../../utils/s3");
function toPublicUrl(key) {
    if (!env_1.env.CLOUDFRONT_DOMAIN) {
        throw new Error('CLOUDFRONT_DOMAIN is not configured in this deployment');
    }
    const base = env_1.env.CLOUDFRONT_DOMAIN.replace(/\/$/, '');
    const k = key.replace(/^\//, '');
    return `${base}/${k}`;
}
async function listModules(courseId, requesterRole) {
    const course = await db_1.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, isPublished: true }
    });
    if (!course)
        throw (0, apiError_1.notFound)('Not found');
    if (requesterRole === 'student' && !course.isPublished) {
        throw (0, apiError_1.forbidden)('Forbidden');
    }
    const where = requesterRole === 'student'
        ? {
            courseId,
            isPublished: true
        }
        : { courseId };
    return db_1.prisma.module.findMany({
        where,
        orderBy: { order: 'asc' },
        select: {
            id: true,
            courseId: true,
            title: true,
            order: true,
            duration: true,
            isPublished: true,
            createdAt: true
        }
    });
}
async function createModule(courseId, requesterRole, input) {
    if (!['admin', 'faculty'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const course = await db_1.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course)
        throw (0, apiError_1.notFound)('Not found');
    const order = typeof input.order === 'number'
        ? input.order
        : (await db_1.prisma.module.count({ where: { courseId } })) + 1;
    return db_1.prisma.module.create({
        data: {
            courseId,
            title: input.title,
            order,
            content: input.content ?? null,
            duration: input.duration ?? null,
            isPublished: input.isPublished ?? false
        },
        select: {
            id: true,
            courseId: true,
            title: true,
            order: true,
            videoUrl: true,
            content: true,
            duration: true,
            isPublished: true,
            createdAt: true
        }
    });
}
async function getModule(courseId, moduleId, requesterRole) {
    const module = await db_1.prisma.module.findFirst({
        where: requesterRole === 'student'
            ? {
                id: moduleId,
                courseId,
                isPublished: true,
                course: { isPublished: true }
            }
            : { id: moduleId, courseId },
        select: {
            id: true,
            courseId: true,
            title: true,
            order: true,
            videoUrl: true,
            content: true,
            duration: true,
            isPublished: true,
            createdAt: true
        }
    });
    if (!module)
        throw (0, apiError_1.notFound)('Not found');
    return {
        ...module,
        videoUrl: module.videoUrl ? toPublicUrl(module.videoUrl) : null
    };
}
async function updateModule(courseId, moduleId, requesterRole, input) {
    if (!['admin', 'faculty'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const existing = await db_1.prisma.module.findFirst({
        where: { id: moduleId, courseId },
        select: { id: true }
    });
    if (!existing)
        throw (0, apiError_1.notFound)('Not found');
    return db_1.prisma.module.update({
        where: { id: moduleId },
        data: {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(typeof input.order === 'number' ? { order: input.order } : {}),
            ...(input.content === null || typeof input.content === 'string' ? { content: input.content } : {}),
            ...(input.duration === null || typeof input.duration === 'number'
                ? { duration: input.duration }
                : {}),
            ...(typeof input.isPublished === 'boolean' ? { isPublished: input.isPublished } : {}),
            ...(input.videoUrl === null || typeof input.videoUrl === 'string' ? { videoUrl: input.videoUrl } : {})
        },
        select: {
            id: true,
            courseId: true,
            title: true,
            order: true,
            videoUrl: true,
            content: true,
            duration: true,
            isPublished: true,
            createdAt: true
        }
    });
}
async function deleteModule(courseId, moduleId, requesterRole) {
    if (!['admin', 'faculty'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const existing = await db_1.prisma.module.findFirst({
        where: { id: moduleId, courseId },
        select: { id: true }
    });
    if (!existing)
        throw (0, apiError_1.notFound)('Not found');
    await db_1.prisma.module.delete({ where: { id: moduleId } });
    return { status: 'ok' };
}
async function presignModuleVideoUpload(courseId, moduleId, requesterRole, contentType) {
    if (!['admin', 'faculty'].includes(requesterRole))
        throw (0, apiError_1.forbidden)('Forbidden');
    const module = await db_1.prisma.module.findFirst({
        where: { id: moduleId, courseId },
        select: { id: true }
    });
    if (!module)
        throw (0, apiError_1.notFound)('Not found');
    const ext = (() => {
        if (contentType === 'video/mp4')
            return 'mp4';
        if (contentType === 'video/webm')
            return 'webm';
        return 'bin';
    })();
    const key = `course-videos/${courseId}/${moduleId}/${(0, uuid_1.v4)()}.${ext}`;
    const presigned = await (0, s3_1.presignPutObject)({
        key,
        contentType,
        expiresInSeconds: 3600
    });
    // Store the S3 key; serving uses CloudFront URL.
    await db_1.prisma.module.update({
        where: { id: moduleId },
        data: { videoUrl: key }
    });
    return presigned;
}
