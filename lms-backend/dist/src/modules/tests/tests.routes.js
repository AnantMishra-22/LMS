"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const validate_1 = require("../../middleware/validate");
const tests_controller_1 = require("./tests.controller");
exports.testsRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({ id: zod_1.z.string().uuid() });
const optionSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    text: zod_1.z.string().min(1)
});
const questionSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    options: zod_1.z.array(optionSchema).min(2),
    answer: zod_1.z.string().min(1),
    points: zod_1.z.coerce.number().int().min(1).default(1),
    order: zod_1.z.coerce.number().int().min(1)
});
const createSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1).nullable().optional(),
    startTime: zod_1.z.coerce.date().nullable().optional(),
    endTime: zod_1.z.coerce.date().nullable().optional(),
    durationSeconds: zod_1.z.coerce.number().int().min(60).max(24 * 60 * 60).nullable().optional(),
    questions: zod_1.z.array(questionSchema).min(1)
});
const updateSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).nullable().optional(),
    startTime: zod_1.z.coerce.date().nullable().optional(),
    endTime: zod_1.z.coerce.date().nullable().optional(),
    durationSeconds: zod_1.z.coerce.number().int().min(60).max(24 * 60 * 60).nullable().optional()
})
    .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const attemptSchema = zod_1.z.object({
    answers: zod_1.z.record(zod_1.z.string().uuid(), zod_1.z.string().min(1))
});
exports.testsRouter.get('/', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), tests_controller_1.testsController.list);
exports.testsRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)(createSchema), tests_controller_1.testsController.create);
exports.testsRouter.get('/:id', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.getById);
exports.testsRouter.patch('/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)({ params: idParams, body: updateSchema }), tests_controller_1.testsController.update);
exports.testsRouter.post('/:id/questions', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)({ params: idParams, body: questionSchema }), tests_controller_1.testsController.addQuestion);
exports.testsRouter.post('/:id/attempt/start', auth_1.authenticate, (0, rbac_1.only)('student'), rateLimiter_1.testLimiter, (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.startAttempt);
exports.testsRouter.get('/:id/attempt/active', auth_1.authenticate, (0, rbac_1.only)('student'), (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.activeAttempt);
exports.testsRouter.post('/:id/attempt', auth_1.authenticate, (0, rbac_1.only)('student'), rateLimiter_1.testLimiter, (0, validate_1.validate)({ params: idParams, body: attemptSchema }), tests_controller_1.testsController.attempt);
exports.testsRouter.get('/:id/results', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer', 'faculty'), (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.results);
exports.testsRouter.get('/:id/monitoring', auth_1.authenticate, (0, rbac_1.only)('trainer'), (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.monitoring);
exports.testsRouter.get('/:id/my-result', auth_1.authenticate, (0, rbac_1.only)('student'), (0, validate_1.validate)({ params: idParams }), tests_controller_1.testsController.myResult);
