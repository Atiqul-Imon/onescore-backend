import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { StatusCodes } from 'http-status-codes';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let { statusCode = StatusCodes.INTERNAL_SERVER_ERROR, message } = error;

  // Log error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation Error';
  }

  if (error.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid ID format';
  }

  if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate field value';
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Token expired';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    message = 'Something went wrong!';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`Route ${req.originalUrl} not found`) as AppError;
  error.statusCode = StatusCodes.NOT_FOUND;
  error.isOperational = true;
  next(error);
};

type AsyncExpressHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler = (fn: AsyncExpressHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
