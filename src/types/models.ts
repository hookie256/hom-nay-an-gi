/**
 * Data model theo Chương 5 của báo cáo (Bảng 5.2 – 5.17).
 * ObjectId được biểu diễn bằng string. Date được biểu diễn bằng chuỗi ISO 8601.
 * Các trường đánh dấu [BỔ SUNG] không có trong báo cáo, được thêm theo quyết định đã xác nhận
 * (xem docs/assumptions.md).
 */

export type Id = string;
export type ISODate = string;

// ---------- users & user_profiles (5.3) ----------
export type Role = 'user' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'locked';

export interface User {
  _id: Id;
  email: string;
  passwordHash: string;
  role: Role;
  status: AccountStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** User không có passwordHash – dạng duy nhất được trả qua API (NFR05). */
export type PublicUser = Omit<User, 'passwordHash'> & { displayName?: string };

export interface UserProfile {
  _id: Id;
  userId: Id;
  displayName?: string;
  tastes: string[];
  favoriteCategoryIds: Id[];
  cuisineIds: Id[];
  dietCodes: string[];
  avoidedIngredientIds: Id[];
  preferredCookMinutes?: number;
  saveHistory: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------- categories & units (5.5) ----------
export type CategoryType = 'mealSlot' | 'dishType' | 'cuisine' | 'tag';
export type CategoryStatus = 'active' | 'hidden';

export interface Category {
  _id: Id;
  type: CategoryType;
  name: string;
  slug: string;
  status: CategoryStatus;
  displayOrder?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ActiveStatus = 'active' | 'inactive';

export interface Unit {
  _id: Id;
  name: string;
  symbol: string;
  status: ActiveStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------- ingredients (5.4.2) ----------
export interface Ingredient {
  _id: Id;
  canonicalName: string;
  aliases: string[];
  groupId?: string;
  substitutionIds: Id[];
  /** [BỔ SUNG] ghi chú khác biệt khi thay thế, theo UC59 “nhập ghi chú”. key = id nguyên liệu thay thế */
  substitutionNotes?: Record<Id, string>;
  avoidTags: string[];
  status: ActiveStatus;
}

// ---------- dishes (5.4.1) ----------
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DishStatus = 'draft' | 'published' | 'hidden';

export interface DishIngredient {
  ingredientId: Id;
  quantity: number;
  unitId: Id;
  required: boolean;
  preparationNote?: string;
}

export interface DishStep {
  stepNo: number;
  title: string;
  instruction: string;
  durationMinutes?: number;
  /** [BỔ SUNG] UC32/UC62 nhắc tới hình minh họa của bước */
  imageUrl?: string;
  /** [BỔ SUNG] UC32 nhắc tới lưu ý của bước */
  note?: string;
}

export interface Nutrition {
  calories?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  /** Nguồn hoặc phạm vi tính toán (RR11) */
  basis?: string;
}

export interface Dish {
  _id: Id;
  slug: string;
  name: string;
  description?: string;
  images: string[];
  mealSlotIds: Id[];
  categoryIds: Id[];
  cuisineIds: Id[];
  tasteTags: string[];
  /** [BỔ SUNG] chế độ ăn món đáp ứng; undefined = chưa khai báo (không đủ dữ liệu) */
  dietCodes?: string[];
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  status: DishStatus;
  ingredients: DishIngredient[];
  steps: DishStep[];
  nutrition?: Nutrition;
  source?: string;
  /** Thời điểm xuất bản lần đầu – dùng cho “Món mới” (mục 6.5) */
  publishedAt?: ISODate;
  /** Phiên bản để phát hiện xung đột khi hai quản trị viên cùng sửa (UC54) */
  version: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------- favorites, reviews, review_reports (5.6) ----------
export interface Favorite {
  _id: Id;
  userId: Id;
  dishId: Id;
  createdAt: ISODate;
}

/** [BỔ SUNG] thêm 'pending' – đánh giá mới/vừa sửa chờ kiểm duyệt (UC37, 6.11) */
export type ModerationStatus = 'pending' | 'published' | 'hidden';

export interface Review {
  _id: Id;
  userId: Id;
  dishId: Id;
  rating: number;
  body?: string;
  moderationStatus: ModerationStatus;
  moderationReason?: string;
  moderatedBy?: Id;
  moderatedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ReportStatus = 'open' | 'resolved' | 'rejected';

export interface ReviewReport {
  _id: Id;
  reviewId: Id;
  reporterId: Id;
  reason: string;
  status: ReportStatus;
  /** Kết quả xử lý: giữ hoặc ẩn nhận xét */
  resolution?: 'kept' | 'hidden';
  createdAt: ISODate;
  resolvedBy?: Id | null;
  resolvedAt?: ISODate | null;
}

// ---------- selling_menus, carts, orders (5.7) ----------
export interface TimeRange {
  /** "HH:mm" theo múi giờ cấu hình */
  start: string;
  end: string;
}

export interface SellingMenu {
  _id: Id;
  dishId: Id;
  price: number;
  currency: string;
  available: boolean;
  /** Rỗng/undefined = dùng khung giờ mặc định trong OrderSettings */
  receivingHours?: TimeRange[];
  validFrom: ISODate;
  validTo?: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Thiết lập thời gian nhận đơn chung (UC79) */
export interface OrderSettings {
  timezone: string;
  defaultReceivingHours: TimeRange[];
  maxQuantityPerItem: number;
  updatedAt: ISODate;
}

export interface CartItem {
  dishId: Id;
  quantity: number;
  /** Giá tạm tính đã hiển thị cho người dùng lúc thêm/xác nhận gần nhất */
  seenPrice?: number;
}

export interface Cart {
  _id: Id;
  userId: Id;
  items: CartItem[];
  updatedAt: ISODate;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'completed' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'processing' | 'paid' | 'failed' | 'refund_pending' | 'refunded';
export type PaymentMethod = 'cod' | 'online';

export interface OrderItem {
  dishId: Id;
  snapshotName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface ReceiveInfo {
  receiverName: string;
  phone: string;
  method: 'delivery' | 'pickup';
  address?: string;
  note?: string;
}

export interface CancelRequest {
  reason: string;
  requestedAt: ISODate;
  status: 'pending' | 'approved' | 'rejected';
  decisionReason?: string;
  decidedBy?: Id;
  decidedAt?: ISODate;
}

export interface Order {
  _id: Id;
  /** Mã đơn hiển thị cho người dùng */
  code: string;
  userId: Id;
  items: OrderItem[];
  total: number;
  currency: string;
  receiveInfo: ReceiveInfo;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  cancelRequest?: CancelRequest;
  rejectReason?: string;
  idempotencyKey?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface OrderEvent {
  _id: Id;
  orderId: Id;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId: Id | null;
  reason?: string;
  /** Ghi chú thêm, ví dụ thay đổi trạng thái thanh toán */
  note?: string;
  createdAt: ISODate;
}

// ---------- events & logs (5.8) ----------
export type ActivityEventType = 'view_dish' | 'choose_from_recommendation';

export interface ActivityEvent {
  _id: Id;
  userId: Id;
  eventType: ActivityEventType;
  dishId: Id;
  recommendationEventId?: Id;
  createdAt: ISODate;
}

export interface RecommendationCriteria {
  mode: 'meal' | 'ingredients';
  mealSlot?: string;
  ingredientIds?: Id[];
  maxMinutes?: number;
  diet?: string[];
  excludeIngredientIds?: Id[];
}

export interface RecommendationEvent {
  _id: Id;
  userId: Id | null;
  requestCriteria: RecommendationCriteria;
  suggestedDishIds: Id[];
  chosenDishId?: Id;
  /** Món đã bỏ qua trong lượt (UC13) */
  dismissedDishIds: Id[];
  /** Món đã mở chi tiết từ lượt này */
  openedDishIds: Id[];
  displayStatus: 'shown' | 'dismissed';
  createdAt: ISODate;
}

export type AuditTargetType = 'user' | 'dish' | 'ingredient' | 'category' | 'selling_menu' | 'order' | 'review' | 'unit' | 'settings';

export interface AdminAuditLog {
  _id: Id;
  actorId: Id;
  targetType: AuditTargetType;
  targetId: Id;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: ISODate;
}

// ---------- collection phụ trợ (5.2) ----------
export interface Session {
  _id: Id;
  token: string;
  userId: Id;
  expiresAt: ISODate;
  revokedAt?: ISODate;
  createdAt: ISODate;
}

export interface PasswordResetToken {
  _id: Id;
  token: string;
  userId: Id;
  expiresAt: ISODate;
  usedAt?: ISODate;
}

export interface SearchEvent {
  _id: Id;
  userId?: Id;
  keyword?: string;
  ingredientIds?: Id[];
  createdAt: ISODate;
}

export interface IngredientSelection {
  _id: Id;
  userId: Id;
  ingredientIds: Id[];
  updatedAt: ISODate;
}
