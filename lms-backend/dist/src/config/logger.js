"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("./env");
const isProd = env_1.env.NODE_ENV === 'production';
const isTest = env_1.env.NODE_ENV === 'test';
function hasPrettyTransport() {
    try {
        require.resolve('pino-pretty');
        return true;
    }
    catch {
        return false;
    }
}
const usePrettyTransport = !isProd && !isTest && hasPrettyTransport();
exports.logger = (0, pino_1.default)({
    level: isTest ? 'silent' : process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    ...(usePrettyTransport
        ? {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname'
                }
            }
        }
        : {})
});
