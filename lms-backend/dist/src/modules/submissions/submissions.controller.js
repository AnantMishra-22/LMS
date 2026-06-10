"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const submissions_service_1 = require("./submissions.service");
exports.submissionsController = {
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, submissions_service_1.createSubmission)({ id: req.user.id, role: req.user.role }, body);
        // Match contract: success shape is top-level.
        return res.status(201).json(result);
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const submission = await (0, submissions_service_1.getSubmissionById)({ id: req.user.id, role: req.user.role }, req.params.id);
        return res.status(200).json({ data: submission });
    }),
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const query = req.query;
        const result = await (0, submissions_service_1.listSubmissions)({ id: req.user.id, role: req.user.role }, query);
        return res.status(200).json({ data: result });
    }),
    gradingQueue: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, submissions_service_1.getGradingQueue)();
        return res.status(200).json({ data: result });
    }),
    grade: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, submissions_service_1.gradeSubmission)(req.params.id, body, req.user.id);
        return res.status(200).json({ data: result });
    }),
    recover: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, submissions_service_1.listPendingSubmissionsForUser)({ id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: items });
    })
};
