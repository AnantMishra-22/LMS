"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const env_1 = require("../../config/env");
const users_controller_1 = require("./users.controller");
exports.usersRouter = (0, express_1.Router)();
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid()
});
const listQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    role: env_1.roleEnum.optional(),
    search: zod_1.z.string().min(1).optional()
});
const createSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(1),
    role: env_1.roleEnum,
    institutionId: zod_1.z.string().uuid().optional()
});
const updateSchema = zod_1.z
    .object({
    email: zod_1.z.string().email().optional(),
    name: zod_1.z.string().min(1).optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
    role: env_1.roleEnum.optional(),
    institutionId: zod_1.z.string().uuid().nullable().optional()
})
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
const avatarSchema = zod_1.z.object({
    contentType: zod_1.z.enum(['image/png', 'image/jpeg', 'image/webp'])
});
exports.usersRouter.get('/', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ query: listQuerySchema }), users_controller_1.usersController.list);
exports.usersRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)(createSchema), users_controller_1.usersController.create);
exports.usersRouter.get('/me', auth_1.authenticate, users_controller_1.usersController.me);
exports.usersRouter.post('/me/avatar', auth_1.authenticate, (0, validate_1.validate)(avatarSchema), users_controller_1.usersController.avatar);
exports.usersRouter.get('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParamSchema }), users_controller_1.usersController.getById);
exports.usersRouter.patch('/:id', auth_1.authenticate, (0, validate_1.validate)({ params: idParamSchema, body: updateSchema }), users_controller_1.usersController.update);
const resetPasswordSchema = zod_1.z.object({ password: zod_1.z.string().min(8) });
const statusSchema = zod_1.z.object({ isActive: zod_1.z.boolean() });
exports.usersRouter.post('/:id/reset-password', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParamSchema, body: resetPasswordSchema }), users_controller_1.usersController.resetPassword);
exports.usersRouter.patch('/:id/status', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParamSchema, body: statusSchema }), users_controller_1.usersController.updateStatus);
exports.usersRouter.delete('/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParamSchema }), users_controller_1.usersController.softDelete);
