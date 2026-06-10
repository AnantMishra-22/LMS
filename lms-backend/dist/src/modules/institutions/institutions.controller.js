"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.institutionsController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const institutions_service_1 = require("./institutions.service");
exports.institutionsController = {
    list: (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        const data = await (0, institutions_service_1.listInstitutions)();
        return res.status(200).json({ data });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, institutions_service_1.createInstitution)(req.body);
        return res.status(201).json({ data });
    }),
    get: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, institutions_service_1.getInstitution)(req.params.id);
        return res.status(200).json({ data });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, institutions_service_1.updateInstitution)(req.params.id, req.body);
        return res.status(200).json({ data });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, institutions_service_1.deleteInstitution)(req.params.id);
        return res.status(200).json({ data });
    })
};
