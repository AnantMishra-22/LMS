"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const apiError_1 = require("./apiError");
(0, vitest_1.describe)('api errors', () => {
    (0, vitest_1.it)('creates typed http errors', () => {
        (0, vitest_1.expect)((0, apiError_1.badRequest)('Bad').statusCode).toBe(400);
        (0, vitest_1.expect)((0, apiError_1.unauthorized)().statusCode).toBe(401);
        (0, vitest_1.expect)((0, apiError_1.forbidden)().statusCode).toBe(403);
        (0, vitest_1.expect)((0, apiError_1.notFound)().statusCode).toBe(404);
        (0, vitest_1.expect)((0, apiError_1.conflict)().statusCode).toBe(409);
    });
});
