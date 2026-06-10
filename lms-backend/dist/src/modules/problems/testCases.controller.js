"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCasesController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const testCases_service_1 = require("./testCases.service");
exports.testCasesController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, testCases_service_1.listTestCases)(req.params.id, req.user.role);
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const testCase = await (0, testCases_service_1.createTestCase)(req.params.id, req.user.role, body);
        return res.status(201).json({ data: testCase });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const testCase = await (0, testCases_service_1.updateTestCase)(req.params.id, req.params.caseId, req.user.role, body);
        return res.status(200).json({ data: testCase });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, testCases_service_1.deleteTestCase)(req.params.id, req.params.caseId, req.user.role);
        return res.status(200).json({ data: result });
    })
};
