"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.badRequest = badRequest;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.notFound = notFound;
exports.conflict = conflict;
class ApiError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.ApiError = ApiError;
function badRequest(message) {
    return new ApiError(400, message);
}
function unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
}
function forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
}
function notFound(message = 'Not found') {
    return new ApiError(404, message);
}
function conflict(message = 'Conflict') {
    return new ApiError(409, message);
}
