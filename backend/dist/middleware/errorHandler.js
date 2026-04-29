"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppError_1 = require("../utils/AppError");
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, _next) {
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({ success: false, message: err.message });
        return;
    }
    logger_1.logger.error('Unhandled error:', { message: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, message: 'Une erreur interne est survenue.' });
}
//# sourceMappingURL=errorHandler.js.map