import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  } as ApiResponse<T>);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  data?: any
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(data && { data }),
  } as ApiResponse);
}
