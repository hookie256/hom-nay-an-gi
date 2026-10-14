/**
 * Hợp đồng API giữa giao diện và máy chủ (theo mục 5.13). Khi có backend FastAPI thật,
 * backend cần trả đúng các cấu trúc này để giao diện không phải thay đổi.
 */
import type {
  AdminAuditLog, Category, CancelRequest, Difficulty, Dish, DishStatus, Id, Ingredient, ModerationStatus, Order,
  OrderEvent, OrderSettings, PublicUser, ReportStatus, Review, SellingMenu, TimeRange, Unit, UserProfile, ActivityEventType,
} from './models';

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface SellingInfo {
  price: number;
  currency: string;
  orderable: boolean;
  reason?: string;
  receivingHours: TimeRange[];
}

export interface DishCard {
  _id: Id;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  difficulty: Difficulty;
  mealSlotIds: Id[];
  rating: { avg: number; count: number } | null;
  selling: SellingInfo | null;
  isFavorite?: boolean;
}

export interface ResolvedDishIngredient {
  ingredientId: Id;
  name: string;
  groupId?: string;
  quantity: number;
  unit: { _id: Id; name: string; symbol: string } | null;
  required: boolean;
  preparationNote?: string;
  substitutes: { _id: Id; name: string; note?: string }[];
}

export interface DishDetail extends Omit<Dish, 'ingredients' | 'status' | 'version' | 'source'> {
  ingredients: ResolvedDishIngredient[];
  mealSlots: Category[];
  categories: Category[];
  cuisines: Category[];
  rating: { avg: number; count: number } | null;
  selling: SellingInfo | null;
  related: DishCard[];
  isFavorite: boolean;
  source?: string;
}

export interface DishListQuery {
  q?: string;
  ingredient?: Id[];
  mealSlot?: string[];
  dishType?: string[];
  cuisine?: string[];
  tag?: string[];
  difficulty?: Difficulty[];
  taste?: string[];
  diet?: string[];
  maxMinutes?: number;
  exclude?: Id[];
  sort?: 'relevance' | 'rating' | 'time' | 'newest' | 'popular';
  page?: number;
  pageSize?: number;
}

export interface DishListResult extends Paginated<DishCard> {
  needsVerification: number;
  /** true khi sắp xếp “phổ biến” nhưng chưa có dữ liệu phổ biến (UC21) */
  popularityUnavailable?: boolean;
}

export interface MatchSummary {
  ratio: number | null;
  requiredTotal: number;
  requiredHave: number;
  have: { _id: Id; name: string }[];
  missing: { _id: Id; name: string }[];
  optional: { _id: Id; name: string; have: boolean }[];
}

export interface RecommendationItem {
  dish: DishCard;
  score: number;
  reasons: string[];
  match?: MatchSummary;
}

export interface RecommendationRequest {
  mode: 'meal' | 'ingredients';
  mealSlot?: string;
  ingredientIds?: Id[];
  maxMinutes?: number;
  diet?: string[];
  excludeIngredientIds?: Id[];
  limit?: number;
}

export interface RecommendationResult {
  eventId: Id;
  mealSlot?: Category;
  items: RecommendationItem[];
  emptyReason?: string;
  excludedNeedsVerification: number;
  /** Có áp dụng nguyên liệu cần tránh từ hồ sơ không */
  appliedProfile: boolean;
}

export interface ReplaceResult {
  item: RecommendationItem | null;
  emptyReason?: string;
}

export interface PublicReview {
  _id: Id;
  dishId: Id;
  rating: number;
  body?: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface MyReview extends Review {}

export interface HistoryItem {
  _id: Id;
  eventType: ActivityEventType;
  createdAt: string;
  dish: { _id: Id; slug: string; name: string; available: boolean; image?: string };
}

export interface FavoriteItem {
  dishId: Id;
  createdAt: string;
  dish: DishCard | null;
  available: boolean;
  name: string;
}

export interface CartLine {
  dishId: Id;
  slug: string;
  name: string;
  image?: string;
  quantity: number;
  unitPrice: number | null;
  seenPrice?: number;
  lineTotal: number | null;
  orderable: boolean;
  issue?: string;
}

export interface CartView {
  items: CartLine[];
  subtotal: number;
  currency: string;
  maxQuantityPerItem: number;
  issues: { dishId: Id; message: string; type: string }[];
  ok: boolean;
}

export interface CreateOrderRequest {
  receiveInfo: Order['receiveInfo'];
  paymentMethod: Order['paymentMethod'];
  idempotencyKey: string;
}

export interface OrderDetail extends Order {
  events: OrderEvent[];
  cancelMode: 'direct' | 'request' | 'not_allowed';
  userEmail?: string;
}

// ---------- admin ----------
export interface AdminDishRow {
  _id: Id;
  slug: string;
  name: string;
  status: DishStatus;
  mealSlotIds: Id[];
  updatedAt: string;
  ingredientCount: number;
  stepCount: number;
  selling: boolean;
}

export type DishInput = Pick<Dish,
  'name' | 'slug' | 'description' | 'images' | 'mealSlotIds' | 'categoryIds' | 'cuisineIds' | 'tasteTags' | 'dietCodes' |
  'baseServings' | 'prepMinutes' | 'cookMinutes' | 'difficulty' | 'ingredients' | 'steps' | 'nutrition' | 'source'>;

export interface ValidationResult {
  ok: boolean;
  issues: { field: string; message: string }[];
}

export interface IngredientRow extends Ingredient {
  usageCount: number;
}

export interface UnitRow extends Unit {
  usageCount: number;
}

export interface CategoryRow extends Category {
  usageCount: number;
}

export interface AdminUserRow extends PublicUser {
  displayName?: string;
}

export interface AdminReviewRow extends Review {
  dishName: string;
  authorEmail: string;
  openReports: number;
}

export interface AdminReportRow {
  _id: Id;
  reason: string;
  status: ReportStatus;
  resolution?: 'kept' | 'hidden';
  createdAt: string;
  resolvedAt?: string | null;
  resolvedByEmail?: string;
  reporterEmail: string;
  review: { _id: Id; body?: string; rating: number; moderationStatus: ModerationStatus; dishName: string } | null;
}

export interface SellingMenuRow extends SellingMenu {
  dishName: string;
  dishSlug: string;
  dishStatus: DishStatus;
  orderableNow: boolean;
  reason?: string;
}

export interface AdminOrderRow extends Order {
  userEmail: string;
}

export interface AdminAuditRow extends AdminAuditLog {
  actorEmail: string;
}

export interface StatsOverview {
  from: string;
  to: string;
  totalUsers: number;
  newUsers: number;
  publishedDishes: number;
  totalDishes: number;
  dishViews: number;
  distinctViewers: number;
  recommendations: number;
  orders: number;
  completedOrders: number;
  revenueCompleted: number;
  favoritesAdded: number;
  daily: { date: string; views: number; recommendations: number; orders: number }[];
}

export interface StatsTop {
  dishes: { dishId: Id; name: string; views: number; favorites: number; suggested: number; score: number }[];
  keywords: { keyword: string; count: number }[];
  ingredients: { ingredientId: Id; name: string; count: number }[];
  sampleSize: { searches: number; ingredientSearches: number };
}

export interface StatsRecommendation {
  shown: number;
  withOpen: number;
  withChoose: number;
  withOrder: number | null;
  openRate: number | null;
  chooseRate: number | null;
  orderRate: number | null;
  definitions: Record<string, string>;
}

export type { OrderSettings, CancelRequest, UserProfile };
