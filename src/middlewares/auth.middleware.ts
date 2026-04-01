import { Request, Response, NextFunction } from 'express';
import { TokenHelper, TokenPayload } from '@utils/jwt';
import { UnauthorizedError } from '@utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = TokenHelper.verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    next(error);
  }
}
