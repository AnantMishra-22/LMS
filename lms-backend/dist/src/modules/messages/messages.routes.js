"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const messages_controller_1 = require("./messages.controller");
exports.messagesRouter = (0, express_1.Router)();
const idParams = zod_1.z.object({ id: zod_1.z.string().uuid() });
const threadParams = zod_1.z.object({ userId: zod_1.z.string().uuid() });
const threadQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50)
});
const sendSchema = zod_1.z.object({
    receiverId: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1).max(5_000)
});
exports.messagesRouter.get('/', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), messages_controller_1.messagesController.inbox);
exports.messagesRouter.get('/unread-count', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), messages_controller_1.messagesController.unreadCount);
exports.messagesRouter.get('/thread/:userId', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), (0, validate_1.validate)({ params: threadParams, query: threadQuery }), messages_controller_1.messagesController.thread);
exports.messagesRouter.post('/', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), (0, validate_1.validate)(sendSchema), messages_controller_1.messagesController.send);
exports.messagesRouter.patch('/:id/read', auth_1.authenticate, (0, rbac_1.only)('student', 'faculty', 'trainer', 'admin'), (0, validate_1.validate)({ params: idParams }), messages_controller_1.messagesController.read);
