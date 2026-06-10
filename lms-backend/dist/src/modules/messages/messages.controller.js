"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const messages_service_1 = require("./messages.service");
exports.messagesController = {
    inbox: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, messages_service_1.listInbox)(req.user.id);
        return res.status(200).json({ data });
    }),
    thread: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const query = req.query;
        const data = await (0, messages_service_1.getThread)(req.user.id, req.params.userId, query.page, query.limit);
        return res.status(200).json({ data });
    }),
    send: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const data = await (0, messages_service_1.sendMessage)(req.user.id, body);
        return res.status(201).json({ data });
    }),
    read: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, messages_service_1.markRead)(req.user.id, req.params.id);
        return res.status(200).json({ data });
    }),
    unreadCount: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, messages_service_1.unreadCount)(req.user.id);
        return res.status(200).json(data);
    })
};
