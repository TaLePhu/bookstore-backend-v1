import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '@utils/errors';
import { sendError } from '@utils/response';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err);

  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      sendError(res, err.message, err.statusCode, err.errors);
      return;
    }
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Unknown error
  console.error('Unexpected error:', err);
  sendError(res, 'Internal server error', 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
}
