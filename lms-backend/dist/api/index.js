"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("../src/app");
/**
 * Vercel serverless entry point.
 *
 * Vercel looks for a default export from api/index.ts and wraps it as a
 * serverless function. All requests are routed here via vercel.json rewrites.
 *
 * Do NOT use src/server.ts as the Vercel entry — that file calls app.listen()
 * which is not compatible with the serverless runtime.
 */
const app = (0, app_1.createApp)();
exports.default = app;
