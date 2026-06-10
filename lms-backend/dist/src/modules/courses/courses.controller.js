"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const courses_service_1 = require("./courses.service");
exports.coursesController = {
    list: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const items = await (0, courses_service_1.listCourses)(req.user.role);
        return res.status(200).json({ data: items });
    }),
    create: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const body = req.body;
        const course = await (0, courses_service_1.createCourse)(body);
        return res.status(201).json({ data: course });
    }),
    getById: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const course = await (0, courses_service_1.getCourseById)(req.params.id, req.user.role);
        return res.status(200).json({ data: course });
    }),
    update: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const body = req.body;
        const course = await (0, courses_service_1.updateCourse)(req.params.id, req.user.role, body);
        return res.status(200).json({ data: course });
    }),
    delete: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        const result = await (0, courses_service_1.deleteCourse)(req.params.id, req.user.role);
        return res.status(200).json({ data: result });
    })
};
