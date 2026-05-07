import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationError } from '@utils/errors';

export function validateDto(dtoClass: any) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = plainToInstance(dtoClass, req.body, { enableImplicitConversion: true });
      const errors = await validate(dto, {
        skipMissingProperties: false,
        forbidUnknownValues: true,
      });

      if (errors.length > 0) {
        const errorMessages: Record<string, string[]> = {};
        errors.forEach((error) => {
          errorMessages[error.property] = Object.values(error.constraints || {});
        });
        throw new ValidationError('Validation failed', errorMessages);
      }

      req.body = dto;
      next();
    } catch (error) {
      next(error);
    }
  };
}
