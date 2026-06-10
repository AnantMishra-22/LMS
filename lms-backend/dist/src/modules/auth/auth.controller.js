"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const env_1 = require("../../config/env");
const asyncHandler_1 = require("../../utils/asyncHandler");
const apiError_1 = require("../../utils/apiError");
const auth_service_1 = require("./auth.service");
function refreshCookieOptions() {
    const isProduction = env_1.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
}
exports.authController = {
    login: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        // req.body is validated by validate(loginSchema) in auth.routes.ts
        const body = req.body;
        const result = await (0, auth_service_1.login)(body.email, body.password);
        res.cookie(auth_service_1.REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
        return res.status(200).json({
            accessToken: result.accessToken,
            user: result.user
        });
    }),
    refresh: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const cookieValue = req.cookies?.[auth_service_1.REFRESH_COOKIE_NAME];
        const token = typeof cookieValue === 'string' ? cookieValue : undefined;
        if (!token)
            throw (0, apiError_1.unauthorized)('No refresh token');
        const result = await (0, auth_service_1.refresh)(token);
        return res.status(200).json(result);
    }),
    logout: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const cookieValue = req.cookies?.[auth_service_1.REFRESH_COOKIE_NAME];
        const token = typeof cookieValue === 'string' ? cookieValue : undefined;
        if (token) {
            await (0, auth_service_1.logout)(token);
        }
        res.clearCookie(auth_service_1.REFRESH_COOKIE_NAME, refreshCookieOptions());
        return res.status(200).json({ status: 'ok' });
    }),
    changePassword: (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        if (!req.user)
            throw (0, apiError_1.unauthorized)();
        // req.body is validated by validate(changePasswordSchema) in auth.routes.ts
        const body = req.body;
        await (0, auth_service_1.changePassword)(req.user.id, body.oldPassword, body.newPassword);
        res.clearCookie(auth_service_1.REFRESH_COOKIE_NAME, refreshCookieOptions());
        return res.status(200).json({ status: 'ok' });
    })
};
