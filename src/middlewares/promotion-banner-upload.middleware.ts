import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ValidationError } from '@utils/errors';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Định dạng ảnh banner không hợp lệ. Chỉ hỗ trợ jpg, png, webp.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadPromotionBanner = (req: Request, res: Response, next: NextFunction): void => {
  const handler = upload.single('bannerImage');
  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('Dung lượng ảnh banner vượt quá 2MB.'));
        return;
      }
      next(new ValidationError('Upload ảnh banner thất bại.'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
};

export const normalizePromotionBody = (req: Request, _res: Response, next: NextFunction): void => {
  const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
  const stringFields = ['name', 'description', 'bannerImageUrl', 'startsAt', 'endsAt', 'status'];

  stringFields.forEach((field) => {
    const value = firstValue(req.body[field]);
    if (value !== undefined && value !== null) {
      req.body[field] = String(value);
    }
  });

  const discountPercent = firstValue(req.body.discountPercent);
  if (discountPercent !== undefined && discountPercent !== null && discountPercent !== '') {
    req.body.discountPercent = Number(discountPercent);
  }

  if (typeof req.body.bookIds === 'string') {
    try {
      req.body.bookIds = JSON.parse(req.body.bookIds);
    } catch {
      req.body.bookIds = req.body.bookIds.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
  } else if (Array.isArray(req.body.bookIds)) {
    req.body.bookIds = req.body.bookIds.flatMap((value: unknown) =>
      typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : []
    );
  }
  next();
};
