"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.problemsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const problems_controller_1 = require("./problems.controller");
const testCases_controller_1 = require("./testCases.controller");
exports.problemsRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const testCaseParams = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    caseId: zod_1.z.string().uuid()
});
const listQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).optional(),
    tags: zod_1.z.string().min(1).optional(),
    search: zod_1.z.string().min(1).optional()
});
const createSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']),
    tags: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    timeLimit: zod_1.z.coerce.number().int().min(100).max(15000).optional(),
    memoryLimit: zod_1.z.coerce.number().int().min(16).max(2048).optional(),
    isPublished: zod_1.z.boolean().optional()
});
const updateSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).optional(),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).optional(),
    tags: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    timeLimit: zod_1.z.coerce.number().int().min(100).max(15000).optional(),
    memoryLimit: zod_1.z.coerce.number().int().min(16).max(2048).optional(),
    isPublished: zod_1.z.boolean().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const createTestCaseSchema = zod_1.z.object({
    input: zod_1.z.string(),
    expected: zod_1.z.string(),
    isSample: zod_1.z.boolean().optional(),
    order: zod_1.z.coerce.number().int().min(1).optional()
});
const updateTestCaseSchema = zod_1.z
    .object({
    input: zod_1.z.string().optional(),
    expected: zod_1.z.string().optional(),
    isSample: zod_1.z.boolean().optional(),
    order: zod_1.z.coerce.number().int().min(1).optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
exports.problemsRouter.get('/', auth_1.authenticate, (0, validate_1.validate)({ query: listQuery }), problems_controller_1.problemsController.list);
exports.problemsRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)(createSchema), problems_controller_1.problemsController.create);
exports.problemsRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), problems_controller_1.problemsController.getById);
exports.problemsRouter.patch('/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)({ params: idParams, body: updateSchema }), problems_controller_1.problemsController.update);
exports.problemsRouter.delete('/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParams }), problems_controller_1.problemsController.delete);
// Test cases (privileged)
exports.problemsRouter.get('/:id/test-cases', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)({ params: idParams }), testCases_controller_1.testCasesController.list);
exports.problemsRouter.post('/:id/test-cases', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)({ params: idParams, body: createTestCaseSchema }), testCases_controller_1.testCasesController.create);
exports.problemsRouter.patch('/:id/test-cases/:caseId', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty', 'trainer'), (0, validate_1.validate)({ params: testCaseParams, body: updateTestCaseSchema }), testCases_controller_1.testCasesController.update);
exports.problemsRouter.delete('/:id/test-cases/:caseId', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: testCaseParams }), testCases_controller_1.testCasesController.delete);
