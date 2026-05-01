import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { TokenHelper, TokenPayload } from '@utils/jwt';
import { UnauthorizedError } from '@utils/errors';
import redisConfig from '@config/redis';
import { TOKENS } from '@config/container';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = TokenHelper.verifyAccessToken(token);
    const { userId, deviceId } = payload;

    if (!deviceId) {
      throw new UnauthorizedError('Missing deviceId');
    }

    const sessionKey = `auth:${userId}:${deviceId}`;
    let sessionValue: string | null = null;

    try {
      sessionValue = await redisConfig.get(sessionKey);
    } catch {
      sessionValue = null;
    }

    if (!sessionValue) {
      const refreshTokenRepository = container.resolve<IRefreshTokenRepository>(TOKENS.REFRESH_TOKEN_REPOSITORY);
      const activeSession = await refreshTokenRepository.findActiveByUserIdAndDeviceId(userId, deviceId);
      if (!activeSession) {
        throw new UnauthorizedError('Session revoked');
      }
    }

    (req as any).user = payload;
    next();
  } catch (error) {
    next(error);
  }
}
