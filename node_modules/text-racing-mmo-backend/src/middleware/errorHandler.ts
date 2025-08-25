import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorLogger } from '../utils/ErrorLogger';

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    timestamp: string;
    requestId?: string;
  };
  details?: any;
}

/**
 * Global error handling middleware for Express
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = ErrorLogger.getInstance();
  
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Log the error
  logger.logError(error, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Determine error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An internal server error occurred';
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  }

  const errorResponse: ErrorResponse = {
    error: {
      message,
      code: errorCode,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  // Include details in development
  if (process.env.NODE_ENV === 'development' && details) {
    errorResponse.details = details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    }
  };
  
  res.status(404).json(errorResponse);
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}