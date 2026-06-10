"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function isSchemas(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return 'body' in value || 'params' in value || 'query' in value;
}
function validate(arg) {
    return (req, _res, next) => {
        if (isSchemas(arg)) {
            if (arg.params)
                req.params = arg.params.parse(req.params);
            if (arg.query)
                req.query = arg.query.parse(req.query);
            if (arg.body)
                req.body = arg.body.parse(req.body);
            return next();
        }
        req.body = arg.parse(req.body);
        return next();
    };
}
