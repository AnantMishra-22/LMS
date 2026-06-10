"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const accessPayloadSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    role: env_1.roleEnum,
    email: zod_1.z.string().email()
});
const authenticate = (req, res, next) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
        return res.status(401).json({ error: 'No token' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        const payload = accessPayloadSchema.parse(decoded);
        req.user = payload;
        return next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
