import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ErrorLogger';
export interface ErrorResponse {
    error: {
        message: string;
        code: string;
        timestamp: string;
        requestId?: string;
    };
    details?: any;
}
export declare function errorHandler(error: Error | AppError, req: Request, res: Response, next: NextFunction): void;
export declare function asyncHandler(fn: Function): (req: Request, res: Response, next: NextFunction) => void;
export declare function notFoundHandler(req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map