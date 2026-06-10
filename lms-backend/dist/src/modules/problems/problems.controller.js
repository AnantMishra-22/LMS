"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.problemsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const problems_service_1 = require("./problems.service");
exports.problemsController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const q = req.query;
        const tags = q.tags
            ? q.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined;
        const result = await (0, problems_service_1.listProblems)(req.user.role, {
            page: q.page,
            limit: q.limit,
            difficulty: q.difficulty,
            tags,
            search: q.search
        });
        return res.status(200).json({ data: result });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const problem = await (0, problems_service_1.createProblem)(req.user.role, body);
        return res.status(201).json({ data: problem });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const problem = await (0, problems_service_1.getProblemById)(req.params.id, req.user.role);
        return res.status(200).json({ data: problem });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const problem = await (0, problems_service_1.updateProblem)(req.params.id, req.user.role, body);
        return res.status(200).json({ data: problem });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, problems_service_1.deleteProblem)(req.params.id, req.user.role);
        return res.status(200).json({ data: result });
    })
};
