"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.only = void 0;
const only = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    };
};
exports.only = only;
