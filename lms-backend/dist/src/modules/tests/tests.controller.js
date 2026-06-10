"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const tests_service_1 = require("./tests.service");
exports.testsController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, tests_service_1.listTests)({ id: req.user.id, role: req.user.role });
        return res.status(200).json({ data });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, tests_service_1.createTest)(req.body);
        return res.status(201).json({ data });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, tests_service_1.getTestById)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, tests_service_1.updateTest)(req.params.id, req.body);
        return res.status(200).json({ data });
    }),
    addQuestion: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, tests_service_1.addQuestion)(req.params.id, req.body);
        return res.status(201).json({ data });
    }),
    startAttempt: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, tests_service_1.startAttempt)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(201).json({ data });
    }),
    activeAttempt: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, tests_service_1.getActiveAttempt)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data });
    }),
    attempt: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const data = await (0, tests_service_1.submitAttempt)(req.params.id, { id: req.user.id, role: req.user.role }, body.answers);
        return res.status(201).json(data);
    }),
    results: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, tests_service_1.getTestResults)(req.params.id);
        return res.status(200).json({ data });
    }),
    monitoring: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, tests_service_1.getMonitoring)(req.params.id);
        return res.status(200).json({ data });
    }),
    myResult: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, tests_service_1.getMyResult)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data });
    })
};
