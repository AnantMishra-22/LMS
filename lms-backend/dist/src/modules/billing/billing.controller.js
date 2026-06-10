"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const billing_service_1 = require("./billing.service");
exports.billingController = {
    active: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const query = req.query;
        const data = await (0, billing_service_1.getActiveSubscription)(query.institutionId);
        return res.status(200).json({ data });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, billing_service_1.createSubscription)(req.body);
        return res.status(201).json({ data });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const data = await (0, billing_service_1.updateSubscription)(req.params.id, req.body);
        return res.status(200).json({ data });
    })
};
