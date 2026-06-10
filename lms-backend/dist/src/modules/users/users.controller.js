"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const users_service_1 = require("./users.service");
exports.usersController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const q = req.query;
        const result = await (0, users_service_1.listUsers)({
            page: q.page,
            limit: q.limit,
            role: q.role,
            search: q.search
        });
        return res.status(200).json({ data: result });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const user = await (0, users_service_1.createUser)({
            email: body.email,
            password: body.password,
            name: body.name,
            role: body.role,
            institutionId: body.institutionId
        });
        return res.status(201).json({ data: user });
    }),
    me: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const user = await (0, users_service_1.getUserById)({ id: req.user.id, role: req.user.role }, req.user.id);
        return res.status(200).json({ data: user });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const user = await (0, users_service_1.getUserById)({ id: req.user.id, role: req.user.role }, req.params.id);
        return res.status(200).json({ data: user });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        // Use updateUserFull for richer admin updates
        const user = await (0, users_service_1.updateUserFull)({ id: req.user.id, role: req.user.role }, req.params.id, {
            email: body.email,
            name: body.name,
            avatarUrl: body.avatarUrl,
            isActive: body.isActive,
            role: body.role,
            institutionId: body.institutionId
        });
        return res.status(200).json({ data: user });
    }),
    softDelete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const user = await (0, users_service_1.softDeleteUser)(req.params.id);
        return res.status(200).json({ data: user });
    }),
    avatar: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, users_service_1.presignAvatarUpload)(req.user.id, body.contentType);
        return res.status(200).json({ data: result });
    }),
    resetPassword: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        // Only admin can reset other users' passwords
        if (req.user.role !== 'admin')
            throw (0, apiError_1.unauthorized)();
        await (0, users_service_1.resetUserPassword)(req.params.id, body.password);
        return res.status(200).json({ data: { ok: true } });
    }),
    updateStatus: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        if (req.user.role !== 'admin')
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const user = await (0, users_service_1.updateUserStatus)(req.params.id, body.isActive);
        return res.status(200).json({ data: user });
    })
};
