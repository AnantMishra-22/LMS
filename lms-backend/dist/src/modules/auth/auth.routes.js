"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const validate_1 = require("../../middleware/validate");
const auth_controller_1 = require("./auth.controller");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
const changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8)
});
exports.authRouter.post('/login', rateLimiter_1.authLimiter, (0, validate_1.validate)(loginSchema), auth_controller_1.authController.login);
// Refresh uses httpOnly cookie; do not require access token here.
exports.authRouter.post('/refresh', rateLimiter_1.authLimiter, auth_controller_1.authController.refresh);
exports.authRouter.post('/logout', auth_1.authenticate, rateLimiter_1.authLimiter, auth_controller_1.authController.logout);
exports.authRouter.post('/change-password', auth_1.authenticate, rateLimiter_1.authLimiter, (0, validate_1.validate)(changePasswordSchema), auth_controller_1.authController.changePassword);
