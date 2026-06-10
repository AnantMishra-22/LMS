"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseModulesController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const modules_service_1 = require("./modules.service");
exports.courseModulesController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, modules_service_1.listModules)(req.params.courseId, req.user.role);
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const module = await (0, modules_service_1.createModule)(req.params.courseId, req.user.role, body);
        return res.status(201).json({ data: module });
    }),
    get: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const module = await (0, modules_service_1.getModule)(req.params.courseId, req.params.id, req.user.role);
        return res.status(200).json({ data: module });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const module = await (0, modules_service_1.updateModule)(req.params.courseId, req.params.id, req.user.role, body);
        return res.status(200).json({ data: module });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, modules_service_1.deleteModule)(req.params.courseId, req.params.id, req.user.role);
        return res.status(200).json({ data: result });
    }),
    presignVideo: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, modules_service_1.presignModuleVideoUpload)(req.params.courseId, req.params.id, req.user.role, body.contentType);
        return res.status(200).json({ data: result });
    })
};
