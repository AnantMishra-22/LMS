"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const courses_controller_1 = require("./courses.controller");
const modules_controller_1 = require("./modules.controller");
exports.coursesRouter = (0, express_1.Router)();
const courseIdParams = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const courseIdWithModuleParams = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
    id: zod_1.z.string().uuid()
});
const createCourseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1).nullable().optional(),
    thumbnailUrl: zod_1.z.string().url().nullable().optional()
});
const updateCourseSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).nullable().optional(),
    thumbnailUrl: zod_1.z.string().url().nullable().optional(),
    isPublished: zod_1.z.boolean().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const createModuleSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1).nullable().optional(),
    duration: zod_1.z.coerce.number().int().min(1).nullable().optional(),
    isPublished: zod_1.z.boolean().optional(),
    order: zod_1.z.coerce.number().int().min(1).optional()
});
const updateModuleSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).optional(),
    content: zod_1.z.string().min(1).nullable().optional(),
    duration: zod_1.z.coerce.number().int().min(1).nullable().optional(),
    isPublished: zod_1.z.boolean().optional(),
    order: zod_1.z.coerce.number().int().min(1).optional(),
    videoUrl: zod_1.z.string().min(1).nullable().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const presignVideoSchema = zod_1.z.object({
    contentType: zod_1.z.enum(['video/mp4', 'video/webm'])
});
exports.coursesRouter.get('/', auth_1.authenticate, courses_controller_1.coursesController.list);
exports.coursesRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)(createCourseSchema), courses_controller_1.coursesController.create);
exports.coursesRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: courseIdParams }), courses_controller_1.coursesController.getById);
exports.coursesRouter.patch('/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: courseIdParams, body: updateCourseSchema }), courses_controller_1.coursesController.update);
exports.coursesRouter.delete('/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: courseIdParams }), courses_controller_1.coursesController.delete);
// Course modules
exports.coursesRouter.get('/:courseId/modules', auth_1.authenticate, (0, validate_1.validate)({ params: zod_1.z.object({ courseId: zod_1.z.string().uuid() }) }), modules_controller_1.courseModulesController.list);
exports.coursesRouter.post('/:courseId/modules', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: zod_1.z.object({ courseId: zod_1.z.string().uuid() }), body: createModuleSchema }), modules_controller_1.courseModulesController.create);
exports.coursesRouter.get('/:courseId/modules/:id', auth_1.authenticate, (0, validate_1.validate)({ params: courseIdWithModuleParams }), modules_controller_1.courseModulesController.get);
exports.coursesRouter.patch('/:courseId/modules/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: courseIdWithModuleParams, body: updateModuleSchema }), modules_controller_1.courseModulesController.update);
exports.coursesRouter.delete('/:courseId/modules/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: courseIdWithModuleParams }), modules_controller_1.courseModulesController.delete);
exports.coursesRouter.post('/:courseId/modules/:id/video-upload-url', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: courseIdWithModuleParams, body: presignVideoSchema }), modules_controller_1.courseModulesController.presignVideo);
