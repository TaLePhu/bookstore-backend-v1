import { Router } from 'express';
import { container } from 'tsyringe';
import { AdminUserController } from '@controllers/AdminUserController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { roleGuard } from '@middlewares/role.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { Role } from '@entities/User';
import { UpdateUserStatusDto } from '@dtos/admin/UpdateUserStatusDto';
import { UpdateUserRoleDto } from '@dtos/admin/UpdateUserRoleDto';
import { ResetPasswordDto } from '@dtos/admin/ResetPasswordDto';
import { CreateAdminUserDto } from '@dtos/admin/CreateAdminUserDto';
import { AdminCategoryController } from '@controllers/AdminCategoryController';
import { CreateCategoryDto } from '@dtos/category/CreateCategoryDto';
import { UpdateCategoryDto } from '@dtos/category/UpdateCategoryDto';
import { AdminBookController } from '@controllers/AdminBookController';
import { CreateBookDto } from '@dtos/book/CreateBookDto';
import { UpdateBookDto } from '@dtos/book/UpdateBookDto';
import { uploadBookImages, requireBookImages } from '@middlewares/book-image-upload.middleware';
import { AdminDashboardController } from '@controllers/AdminDashboardController';
import { AdminPromotionController } from '@controllers/AdminPromotionController';
import { CreatePromotionDto } from '@dtos/admin/CreatePromotionDto';
import { UpdatePromotionDto } from '@dtos/admin/UpdatePromotionDto';
import { normalizePromotionBody, uploadPromotionBanner } from '@middlewares/promotion-banner-upload.middleware';

const router = Router();
const adminUserController = container.resolve(AdminUserController);
const adminCategoryController = container.resolve(AdminCategoryController);
const adminBookController = container.resolve(AdminBookController);
const adminDashboardController = container.resolve(AdminDashboardController);
const adminPromotionController = container.resolve(AdminPromotionController);

// ─── Bảo vệ toàn bộ route: phải đăng nhập & phải là ADMIN ─────────────────
router.use(authMiddleware);
router.use(roleGuard(Role.ADMIN));

router.get('/dashboard', adminDashboardController.getDashboard);

router.get('/promotions', adminPromotionController.listPromotions);
router.post(
  '/promotions',
  uploadPromotionBanner,
  normalizePromotionBody,
  validateDto(CreatePromotionDto),
  adminPromotionController.createPromotion,
);
router.put(
  '/promotions/:id',
  uploadPromotionBanner,
  normalizePromotionBody,
  validateDto(UpdatePromotionDto),
  adminPromotionController.updatePromotion,
);
router.delete('/promotions/:id', adminPromotionController.deletePromotion);

// ─── Quản lý tài khoản ──────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Danh sách tất cả tài khoản, lọc theo role, tìm kiếm theo email / fullName.
 * Query: role?, email?, full_name?, page?, limit?
 */
router.get('/users', adminUserController.listUsers);
router.post('/users', validateDto(CreateAdminUserDto), adminUserController.createUser);

/**
 * PATCH /admin/users/:id/status
 * Khoá hoặc mở khoá tài khoản.
 * Body: { isLocked: boolean }
 */
router.patch(
  '/users/:id/status',
  validateDto(UpdateUserStatusDto),
  adminUserController.updateLockStatus,
);

/**
 * PATCH /admin/users/:id/role
 * Cấp / thay đổi role của tài khoản.
 * Body: { role: 'ADMIN' | 'STAFF' | 'CUSTOMER' | 'GUEST' }
 */
router.patch(
  '/users/:id/role',
  validateDto(UpdateUserRoleDto),
  adminUserController.updateRole,
);

/**
 * POST /admin/users/:id/reset-password
 * Đặt lại mật khẩu và gửi email thông báo cho user qua BullMQ.
 * Body: { newPassword: string }
 */
router.post(
  '/users/:id/reset-password',
  validateDto(ResetPasswordDto),
  adminUserController.resetPassword,
);

// ─── Quản lý khách hàng ─────────────────────────────────────────────────────

/**
 * GET /admin/customers/:id/summary
 * Hồ sơ khách hàng: thông tin cá nhân + tổng đơn hàng + tổng chi tiêu.
 */
router.get('/customers/:id/summary', adminUserController.getCustomerSummary);

// ─── Quản lý thể loại ───────────────────────────────────────────────────────

/**
 * GET /admin/categories
 * Lấy danh sách thể loại
 */
router.get('/categories', adminCategoryController.getAllCategories);

/**
 * GET /admin/categories/:id
 * Lấy chi tiết thể loại
 */
router.get('/categories/:id', adminCategoryController.getCategoryById);

/**
 * POST /admin/categories
 * Tạo thể loại mới
 */
router.post(
  '/categories',
  validateDto(CreateCategoryDto),
  adminCategoryController.createCategory,
);

/**
 * PUT /admin/categories/:id
 * Cập nhật thể loại
 */
router.put(
  '/categories/:id',
  validateDto(UpdateCategoryDto),
  adminCategoryController.updateCategory,
);

router.patch('/categories/:id/restore', adminCategoryController.restoreCategory);

router.delete('/categories/:id/hard', adminCategoryController.hardDeleteCategory);

/**
 * DELETE /admin/categories/:id
 * Xóa thể loại
 */
router.delete('/categories/:id', adminCategoryController.deleteCategory);

// ─── Quản lý sách ───────────────────────────────────────────────────────────

/**
 * GET /admin/books
 * Lấy danh sách sách (phân trang, lọc, sắp xếp)
 */
router.get('/books', adminBookController.getAllBooks);

/**
 * GET /admin/books/search
 * Tìm kiếm sách
 */
router.get('/books/search', adminBookController.searchBooks);
router.post('/books/import', adminBookController.importBooks);

/**
 * GET /admin/books/:id
 * Lấy chi tiết sách
 */
router.get('/books/:id', adminBookController.getBookById);

/**
 * POST /admin/books
 * Tạo sách mới
 */
router.post(
  '/books',
  uploadBookImages,
  requireBookImages,
  validateDto(CreateBookDto),
  adminBookController.createBook,
);

/**
 * PUT /admin/books/:id
 * Cập nhật thông tin sách
 */
router.put(
  '/books/:id',
  uploadBookImages,
  validateDto(UpdateBookDto),
  adminBookController.updateBook,
);

/**
 * DELETE /admin/books/:id
 * Xóa sách chưa phát sinh đơn hàng
 */
router.patch('/books/:id/restore', adminBookController.restoreBook);
router.delete('/books/:id/hard', adminBookController.hardDeleteBook);
router.delete('/books/:id', adminBookController.deleteBook);

export default router;
