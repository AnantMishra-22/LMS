"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contestsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const contests_controller_1 = require("./contests.controller");
exports.contestsRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const createSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1).nullable().optional(),
    startTime: zod_1.z.coerce.date(),
    endTime: zod_1.z.coerce.date(),
    isPublic: zod_1.z.boolean().optional(),
    batchId: zod_1.z.string().uuid().nullable().optional(),
    problems: zod_1.z
        .array(zod_1.z.object({
        problemId: zod_1.z.string().uuid(),
        order: zod_1.z.coerce.number().int().min(1),
        points: zod_1.z.coerce.number().int().min(0).optional()
    }))
        .min(1)
});
exports.contestsRouter.get('/', auth_1.authenticate, contests_controller_1.contestsController.list);
const updateSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).nullable().optional(),
    startTime: zod_1.z.coerce.date().optional(),
    endTime: zod_1.z.coerce.date().optional(),
    isPublic: zod_1.z.boolean().optional(),
    batchId: zod_1.z.string().uuid().nullable().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const problemIdParams = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    problemId: zod_1.z.string().uuid()
});
const addProblemSchema = zod_1.z.object({
    problemId: zod_1.z.string().uuid(),
    points: zod_1.z.coerce.number().int().min(0).default(100),
    order: zod_1.z.coerce.number().int().min(1)
});
const submitSchema = zod_1.z.object({
    problemId: zod_1.z.string().uuid(),
    language: zod_1.z.enum(['python', 'c', 'cpp', 'java']),
    code: zod_1.z.string().min(1).max(65_536)
});
exports.contestsRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)(createSchema), contests_controller_1.contestsController.create);
exports.contestsRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), contests_controller_1.contestsController.getById);
exports.contestsRouter.patch('/:id', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)({ params: idParams, body: updateSchema }), contests_controller_1.contestsController.update);
exports.contestsRouter.post('/:id/join', auth_1.authenticate, (0, rbac_1.only)('student'), (0, validate_1.validate)({ params: idParams }), contests_controller_1.contestsController.join);
exports.contestsRouter.get('/:id/leaderboard', auth_1.authenticate, (0, validate_1.validate)({ params: idParams }), contests_controller_1.contestsController.leaderboard);
exports.contestsRouter.post('/:id/problems', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)({ params: idParams, body: addProblemSchema }), contests_controller_1.contestsController.addProblem);
exports.contestsRouter.delete('/:id/problems/:problemId', auth_1.authenticate, (0, rbac_1.only)('admin', 'trainer'), (0, validate_1.validate)({ params: problemIdParams }), contests_controller_1.contestsController.removeProblem);
exports.contestsRouter.post('/:id/submissions', auth_1.authenticate, (0, rbac_1.only)('student'), (0, validate_1.validate)({ params: idParams, body: submitSchema }), contests_controller_1.contestsController.submit);
exports.contestsRouter.get('/:id/my-submissions', auth_1.authenticate, (0, rbac_1.only)('student'), (0, validate_1.validate)({ params: idParams }), contests_controller_1.contestsController.mySubmissions);
