import jwt, { SignOptions } from 'jsonwebtoken';
import { getEnv } from '@config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class TokenHelper {
  private static env = getEnv();

  static generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: this.env.jwt.accessExpiresIn as any,
    };
    return jwt.sign(payload, this.env.jwt.accessSecret, options);
  }

  static generateRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: this.env.jwt.refreshExpiresIn as any,
    };
    return jwt.sign(payload, this.env.jwt.refreshSecret, options);
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.env.jwt.accessSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.env.jwt.refreshSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}
