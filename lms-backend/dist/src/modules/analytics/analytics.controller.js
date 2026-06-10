"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const analytics_service_1 = require("./analytics.service");
exports.analyticsController = {
    overview: (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        const data = await (0, analytics_service_1.overview)();
        return res.status(200).json({ data });
    }),
    submissions: (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        const data = await (0, analytics_service_1.submissionsAnalytics)();
        return res.status(200).json({ data });
    }),
    users: (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        const data = await (0, analytics_service_1.usersAnalytics)();
        return res.status(200).json({ data });
    })
};
