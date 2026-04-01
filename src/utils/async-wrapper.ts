import { Request, Response, NextFunction } from 'express';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export function asyncWrapper(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
