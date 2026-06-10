"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
require("dotenv/config");
const serverless_http_1 = __importDefault(require("serverless-http"));
const app_1 = require("../app");
const app = (0, app_1.createApp)();
exports.handler = (0, serverless_http_1.default)(app);
