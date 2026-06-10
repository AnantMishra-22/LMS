"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("./attendance.controller");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const router = (0, express_1.Router)();
// Public (authenticated) listing - supports optional batchId query
router.get('/', auth_1.authenticate, attendance_controller_1.attendanceController.list);
// Create/close restricted to admins/faculty
router.post('/', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), attendance_controller_1.attendanceController.create);
router.patch('/:id/close', auth_1.authenticate, (0, rbac_1.only)('admin', 'faculty'), attendance_controller_1.attendanceController.close);
// Mark attendance as current user
router.post('/:id/mark', auth_1.authenticate, attendance_controller_1.attendanceController.mark);
exports.default = router;
