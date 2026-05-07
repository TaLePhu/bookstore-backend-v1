import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ValidationError } from '@utils/errors';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Định dạng ảnh không hợp lệ. Chỉ hỗ trợ jpg, png, webp.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadBookImages = (req: Request, res: Response, next: NextFunction): void => {
  const handler = upload.array('images', MAX_FILES);
  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('Dung lượng ảnh vượt quá 2MB.'));
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        next(new ValidationError('Số lượng ảnh vượt quá 5 ảnh.'));
        return;
      }
      next(new ValidationError('Upload ảnh thất bại.'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
};

export const requireBookImages = (req: Request, _res: Response, next: NextFunction): void => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    next(new ValidationError('Hình ảnh sách không được để trống'));
    return;
  }
  next();
};
