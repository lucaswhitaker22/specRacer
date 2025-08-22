import { Request, Response, NextFunction } from 'express';
import { PlayerService } from '../services/PlayerService';

const playerService = new PlayerService();

/**
 * Middleware to authenticate JWT tokens
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required'
      });
    }

    const playerId = await playerService.verifyToken(token);
    
    // Add playerId to request object for use in route handlers
    (req as any).playerId = playerId;
    
    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Invalid or expired token'
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const playerId = await playerService.verifyToken(token);
      (req as any).playerId = playerId;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
}