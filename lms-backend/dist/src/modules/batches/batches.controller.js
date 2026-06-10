"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchesController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const batches_service_1 = require("./batches.service");
exports.batchesController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, batches_service_1.listBatches)({ id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const batch = await (0, batches_service_1.createBatch)(body);
        return res.status(201).json({ data: batch });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const batch = await (0, batches_service_1.getBatchById)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: batch });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const batch = await (0, batches_service_1.updateBatch)(req.params.id, body);
        return res.status(200).json({ data: batch });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const result = await (0, batches_service_1.deleteBatch)(req.params.id);
        return res.status(200).json({ data: result });
    }),
    students: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, batches_service_1.listBatchStudents)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: items });
    }),
    enroll: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const enrollment = await (0, batches_service_1.enrollUser)(req.params.id, {
            userId: body.userId,
            role: body.role
        });
        return res.status(201).json({ data: enrollment });
    }),
    unenroll: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const result = await (0, batches_service_1.unenrollUser)(req.params.id, req.params.userId);
        return res.status(200).json({ data: result });
    }),
    courses: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, batches_service_1.listBatchCourses)(req.params.id, { id: req.user.id, role: req.user.role });
        return res.status(200).json({ data: items });
    }),
    addCourse: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const result = await (0, batches_service_1.addCourseToBatch)(req.params.id, { id: req.user.id, role: req.user.role }, body.courseId);
        return res.status(201).json({ data: result });
    })
};
