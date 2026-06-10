"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const attendance_service_1 = require("./attendance.service");
exports.attendanceController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const batchId = req.query.batchId;
        const items = await (0, attendance_service_1.listAttendanceSessions)(batchId);
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const session = await (0, attendance_service_1.createAttendanceSession)(body);
        return res.status(201).json({ data: session });
    }),
    close: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = req.params.id;
        const session = await (0, attendance_service_1.closeAttendanceSession)(id);
        return res.status(200).json({ data: session });
    }),
    mark: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw new Error('Unauthorized');
        const id = req.params.id;
        const mark = await (0, attendance_service_1.markAttendance)({ id: req.user.id, role: req.user.role }, id);
        return res.status(200).json({ data: mark });
    })
};
