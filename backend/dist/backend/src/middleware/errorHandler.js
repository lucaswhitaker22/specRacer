"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
exports.notFoundHandler = notFoundHandler;
const ErrorLogger_1 = require("../utils/ErrorLogger");
function errorHandler(error, req, res, next) {
    const logger = ErrorLogger_1.ErrorLogger.getInstance();
    const requestId = req.headers['x-request-id'] || generateRequestId();
    logger.logError(error, {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip
    });
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An internal server error occurred';
    let details = undefined;
    if (error instanceof ErrorLogger_1.AppError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        message = error.message;
        details = error.details;
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Invalid request data';
        details = error.message;
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        message = 'Authentication required';
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        errorCode = 'INVALID_ID';
        message = 'Invalid ID format';
    }
    const errorResponse = {
        error: {
            message,
            code: errorCode,
            timestamp: new Date().toISOString(),
            requestId
        }
    };
    if (process.env.NODE_ENV === 'development' && details) {
        errorResponse.details = details;
    }
    res.status(statusCode).json(errorResponse);
}
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function notFoundHandler(req, res) {
    const errorResponse = {
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString()
        }
    };
    res.status(404).json(errorResponse);
}
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=errorHandler.js.map