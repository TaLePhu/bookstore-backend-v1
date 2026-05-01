import bcryptjs from 'bcryptjs';
import { createHash } from 'crypto';
import { getEnv } from '@config/env';

export class HashHelper {
  private static rounds = getEnv().bcryptRounds;

  static async hash(data: string): Promise<string> {
    return bcryptjs.hash(data, this.rounds);
  }

  static async compare(data: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(data, hash);
  }

  static sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
