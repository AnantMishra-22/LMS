"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const env_1 = require("../../config/env");
const batches_controller_1 = require("./batches.controller");
exports.batchesRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const enrollParams = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid()
});
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    institutionId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.coerce.date().nullable().optional(),
    endDate: zod_1.z.coerce.date().nullable().optional()
});
const updateSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).optional(),
    institutionId: zod_1.z.string().uuid().nullable().optional(),
    startDate: zod_1.z.coerce.date().nullable().optional(),
    endDate: zod_1.z.coerce.date().nullable().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const enrollSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    role: env_1.roleEnum
});
const addCourseSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid()
});
exports.batchesRouter.get('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), batches_controller_1.batchesController.list);
exports.batchesRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)(createSchema), batches_controller_1.batchesController.create);
exports.batchesRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), batches_controller_1.batchesController.getById);
exports.batchesRouter.patch('/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParams, body: updateSchema }), batches_controller_1.batchesController.update);
exports.batchesRouter.delete('/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParams }), batches_controller_1.batchesController.delete);
exports.batchesRouter.get('/:id/students', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)({ params: idParams }), batches_controller_1.batchesController.students);
exports.batchesRouter.post('/:id/enroll', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParams, body: enrollSchema }), batches_controller_1.batchesController.enroll);
exports.batchesRouter.delete('/:id/enroll/:userId', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: enrollParams }), batches_controller_1.batchesController.unenroll);
exports.batchesRouter.get('/:id/courses', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), batches_controller_1.batchesController.courses);
exports.batchesRouter.post('/:id/courses', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), (0, validate_1.validate)({ params: idParams, body: addCourseSchema }), batches_controller_1.batchesController.addCourse);
