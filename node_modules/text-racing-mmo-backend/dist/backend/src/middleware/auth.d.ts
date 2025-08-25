import { Request, Response, NextFunction } from 'express';
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map