/**
 * Hằng số nghiệp vụ dùng chung. Mọi giá trị có ghi chú [GIẢ ĐỊNH] là quyết định đã xác nhận
 * vì báo cáo chưa quy định (xem docs/assumptions.md).
 */
import type { Difficulty, ModerationStatus, OrderStatus, PaymentMethod, PaymentStatus, Role } from '@/types/models';

export const DEFAULT_TIMEZONE = (import.meta.env?.VITE_TIMEZONE as string | undefined) || 'Asia/Ho_Chi_Minh';

/** Slug các buổi ăn (categories.type = mealSlot). */
export const MEAL_SLOT_SLUGS = ['bua-sang', 'bua-trua', 'bua-chieu', 'bua-toi'] as const;
export type MealSlotSlug = (typeof MEAL_SLOT_SLUGS)[number];

/** [GIẢ ĐỊNH] Khung giờ xác định buổi mặc định (giờ địa phương, [start, end)). */
export const MEAL_SLOT_HOURS: Record<MealSlotSlug, { start: number; end: number; label: string }> = {
  'bua-sang': { start: 5, end: 10, label: 'Bữa sáng' },
  'bua-trua': { start: 10, end: 14, label: 'Bữa trưa' },
  'bua-chieu': { start: 14, end: 17, label: 'Bữa chiều' },
  'bua-toi': { start: 17, end: 5, label: 'Bữa tối' },
};

/** [GIẢ ĐỊNH] Danh sách khẩu vị (user_profiles.tastes, dishes.tasteTags). */
export const TASTES: { code: string; label: string }[] = [
  { code: 'cay', label: 'Cay' },
  { code: 'ngot', label: 'Ngọt' },
  { code: 'chua', label: 'Chua' },
  { code: 'man', label: 'Đậm đà' },
  { code: 'thanh-dam', label: 'Thanh đạm' },
  { code: 'beo', label: 'Béo' },
];

/** [GIẢ ĐỊNH] Danh sách chế độ ăn (user_profiles.dietCodes, dishes.dietCodes). */
export const DIETS: { code: string; label: string }[] = [
  { code: 'chay', label: 'Ăn chay' },
  { code: 'it-duong', label: 'Ít đường' },
  { code: 'it-dau-mo', label: 'Ít dầu mỡ' },
  { code: 'khong-gluten', label: 'Không gluten' },
];

/** [GIẢ ĐỊNH] Nhóm nguyên liệu (ingredients.groupId). */
export const INGREDIENT_GROUPS: { code: string; label: string }[] = [
  { code: 'rau-cu', label: 'Rau củ' },
  { code: 'thit', label: 'Thịt' },
  { code: 'hai-san', label: 'Hải sản' },
  { code: 'trung-sua', label: 'Trứng & sữa' },
  { code: 'ngu-coc', label: 'Gạo, bún, mì' },
  { code: 'gia-vi', label: 'Gia vị' },
  { code: 'khac', label: 'Khác' },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Người dùng',
  admin: 'Quản trị viên',
  super_admin: 'Quản trị viên cấp cao',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  completed: 'Hoàn thành',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  processing: 'Đang xử lý',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận món',
  online: 'Thanh toán trực tuyến',
};

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  pending: 'Chờ duyệt',
  published: 'Công khai',
  hidden: 'Đã ẩn',
};

/** Trọng số ví dụ ban đầu của thuật toán gợi ý (mục 5.10) – chưa phải trọng số tối ưu. */
export const RECOMMENDATION_WEIGHTS = { ingredients: 40, time: 25, preference: 20, diversity: 15 };

export const PAGE_SIZE = 12;
export const RECOMMENDATION_SIZE = 6;
/** [GIẢ ĐỊNH] Phổ biến = lượt lưu + lượt xem trong 30 ngày gần nhất. */
export const POPULAR_WINDOW_DAYS = 30;
export const REVIEW_REPORT_REASONS = [
  'Ngôn từ xúc phạm',
  'Spam hoặc quảng cáo',
  'Nội dung không liên quan đến món',
  'Thông tin sai lệch',
  'Lý do khác',
];
