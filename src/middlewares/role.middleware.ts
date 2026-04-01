import { Request, Response, NextFunction } from 'express';
import { Role } from '@entities/User';
import { ForbiddenError } from '@utils/errors';

export function roleGuard(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
