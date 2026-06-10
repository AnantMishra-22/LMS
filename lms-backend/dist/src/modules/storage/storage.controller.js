"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const storage_service_1 = require("./storage.service");
exports.storageController = {
    presign: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, storage_service_1.presignUpload)(body);
        return res.status(200).json({ data: result });
    })
};
