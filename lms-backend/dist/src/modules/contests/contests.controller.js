"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contestsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const contests_service_1 = require("./contests.service");
exports.contestsController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, contests_service_1.listContests)({ id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const contest = await (0, contests_service_1.createContest)(req.user.role, body);
        return res.status(201).json({ data: contest });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const contest = await (0, contests_service_1.updateContest)(req.params.id, req.user.role, body);
        return res.status(200).json({ data: contest });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const contest = await (0, contests_service_1.getContestById)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: contest });
    }),
    join: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const entry = await (0, contests_service_1.joinContest)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(201).json({ data: entry });
    }),
    leaderboard: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const data = await (0, contests_service_1.getLeaderboard)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data });
    }),
    addProblem: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, contests_service_1.addProblemToContest)(req.params.id, req.user.role, body);
        return res.status(201).json({ data: result });
    }),
    removeProblem: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, contests_service_1.removeProblemFromContest)(req.params.id, req.params.problemId, req.user.role);
        return res.status(200).json({ data: result });
    }),
    submit: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, contests_service_1.submitToContest)(req.params.id, { id: req.user.id, role: req.user.role }, body);
        return res.status(201).json(result);
    }),
    mySubmissions: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, contests_service_1.getMyContestSubmissions)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: result });
    })
};
