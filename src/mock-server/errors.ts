import type { ApiErrorBody } from '@/types/api';

/** Lỗi API có mã riêng để giao diện xử lý đúng (mục 5.13). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message, ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}) };
  }
}

export const Errors = {
  unauthenticated: () => new ApiError(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để thực hiện thao tác này.'),
  sessionExpired: () => new ApiError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),
  accountLocked: () => new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'),
  forbidden: () => new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'),
  notFound: (what = 'Dữ liệu') => new ApiError(404, 'NOT_FOUND', `${what} không tồn tại hoặc không khả dụng.`),
  dishUnavailable: () => new ApiError(404, 'DISH_UNAVAILABLE', 'Món ăn không tồn tại hoặc không còn được công khai.'),
  validation: (fieldErrors: Record<string, string>, message = 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.') =>
    new ApiError(422, 'VALIDATION_ERROR', message, fieldErrors),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  badRequest: (code: string, message: string) => new ApiError(400, code, message),
};
