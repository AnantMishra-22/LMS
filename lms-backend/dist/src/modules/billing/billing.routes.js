"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const billing_controller_1 = require("./billing.controller");
exports.billingRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({ id: zod_1.z.string().uuid() });
const querySchema = zod_1.z.object({ institutionId: zod_1.z.string().uuid().optional() });
const createSchema = zod_1.z.object({
    institutionId: zod_1.z.string().uuid(),
    plan: zod_1.z.string().min(1),
    status: zod_1.z.string().min(1),
    startsAt: zod_1.z.coerce.date(),
    expiresAt: zod_1.z.coerce.date()
});
const updateSchema = zod_1.z
    .object({
    plan: zod_1.z.string().min(1).optional(),
    status: zod_1.z.string().min(1).optional(),
    startsAt: zod_1.z.coerce.date().optional(),
    expiresAt: zod_1.z.coerce.date().optional()
})
    .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
exports.billingRouter.get('/subscription', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ query: querySchema }), billing_controller_1.billingController.active);
exports.billingRouter.post('/subscription', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)(createSchema), billing_controller_1.billingController.create);
exports.billingRouter.patch('/subscription/:id', auth_1.authenticate, (0, rbac_1.only)('admin'), (0, validate_1.validate)({ params: idParams, body: updateSchema }), billing_controller_1.billingController.update);
