"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const validate_1 = require("../../middleware/validate");
const submissions_controller_1 = require("./submissions.controller");
exports.submissionsRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const createSchema = zod_1.z.object({
    problemId: zod_1.z.string().uuid(),
    language: zod_1.z.enum(['python', 'c', 'cpp', 'java']),
    code: zod_1.z.string().min(1).max(65_536),
    contestId: zod_1.z.string().uuid().optional()
});
const listQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: zod_1.z.enum(['pending', 'running', 'completed', 'failed']).optional(),
    problemId: zod_1.z.string().uuid().optional(),
    contestId: zod_1.z.string().uuid().optional()
});
const gradeSchema = zod_1.z.object({
    verdict: zod_1.z.enum([
        'accepted',
        'wrong_answer',
        'time_limit_exceeded',
        'memory_limit_exceeded',
        'runtime_error',
        'compilation_error'
    ]),
    score: zod_1.z.coerce.number().min(0).optional(),
    feedback: zod_1.z.string().max(10_000).optional()
});
exports.submissionsRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer'), rateLimiter_1.submitLimiter, (0, validate_1.validate)(createSchema), submissions_controller_1.submissionsController.create);
exports.submissionsRouter.get('/', auth_1.authenticate, (0, validate_1.validate)({ query: listQuery }), submissions_controller_1.submissionsController.list);
exports.submissionsRouter.get('/recover', auth_1.authenticate, submissions_controller_1.submissionsController.recover);
exports.submissionsRouter.get('/grading-queue', auth_1.authenticate, (0, rbac_1.only)('faculty', 'admin'), submissions_controller_1.submissionsController.gradingQueue);
exports.submissionsRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), submissions_controller_1.submissionsController.getById);
exports.submissionsRouter.patch('/:id/grade', auth_1.authenticate, (0, rbac_1.only)('faculty', 'admin'), (0, validate_1.validate)({ params: idParams, body: gradeSchema }), submissions_controller_1.submissionsController.grade);
