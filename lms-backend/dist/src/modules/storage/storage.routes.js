"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const storage_controller_1 = require("./storage.controller");
exports.storageRouter = (0, express_1.Router)();
const presignSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).optional(),
    prefix: zod_1.z.string().min(1).optional(),
    filename: zod_1.z.string().min(1).optional(),
    contentType: zod_1.z.enum(['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
});
exports.storageRouter.post('/presign', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), (0, validate_1.validate)(presignSchema), storage_controller_1.storageController.presign);
