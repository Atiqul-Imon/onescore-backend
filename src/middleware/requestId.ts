import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add a unique request ID to each request
 * This helps with tracing and debugging in production
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or use existing request ID from header
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
};

