import type {
  ActivityEvent, AdminAuditLog, Cart, Category, Dish, Favorite, Ingredient, IngredientSelection, Order, OrderEvent,
  OrderSettings, PasswordResetToken, RecommendationEvent, Review, ReviewReport, SearchEvent, SellingMenu, Session, Unit,
  User, UserProfile,
} from '@/types/models';
import { buildTimedSeed, seedAccounts, seedCategories, seedDishes, seedIngredients, seedUnits } from '@/data/seed';
import { hashPassword } from './crypto';

/** 16 collection chính + 4 collection phụ trợ (mục 5.2) + thiết lập nhận đơn. */
export interface DbState {
  schemaVersion: number;
  users: User[];
  user_profiles: UserProfile[];
  categories: Category[];
  units: Unit[];
  ingredients: Ingredient[];
  dishes: Dish[];
  selling_menus: SellingMenu[];
  favorites: Favorite[];
  reviews: Review[];
  review_reports: ReviewReport[];
  carts: Cart[];
  orders: Order[];
  order_events: OrderEvent[];
  recommendation_events: RecommendationEvent[];
  activity_events: ActivityEvent[];
  admin_audit_logs: AdminAuditLog[];
  sessions: Session[];
  password_reset_tokens: PasswordResetToken[];
  search_events: SearchEvent[];
  ingredient_selections: IngredientSelection[];
  order_settings: OrderSettings;
  /** Thống kê tổng hợp lượt xem theo ngày – tách khỏi lịch sử cá nhân (mục 5.8.4) */
  dish_view_stats: { dishId: string; date: string; views: number }[];
}

const STORAGE_KEY = 'hnag-mock-db';
const SCHEMA_VERSION = 1;

let memory: DbState | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export async function createSeedState(now = new Date()): Promise<DbState> {
  const timed = buildTimedSeed(now);
  const created = new Date(now.getTime() - 25 * 86400000).toISOString();
  const users: User[] = await Promise.all(
    seedAccounts.map(async (a) => ({
      _id: a.id, email: a.email, passwordHash: await hashPassword(a.password), role: a.role, status: a.status,
      createdAt: created, updatedAt: created,
    })),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    users,
    user_profiles: timed.profiles,
    categories: structuredClone(seedCategories),
    units: structuredClone(seedUnits),
    ingredients: structuredClone(seedIngredients),
    dishes: structuredClone(seedDishes),
    selling_menus: timed.sellingMenus,
    favorites: timed.favorites,
    reviews: timed.reviews,
    review_reports: timed.reviewReports,
    carts: timed.carts,
    orders: timed.orders,
    order_events: timed.orderEvents,
    recommendation_events: timed.recommendationEvents,
    activity_events: timed.activityEvents,
    admin_audit_logs: [],
    sessions: [],
    password_reset_tokens: [],
    search_events: timed.searchEvents,
    ingredient_selections: [],
    order_settings: timed.orderSettings,
    dish_view_stats: timed.dishViewStats,
  };
}

export async function loadDb(): Promise<DbState> {
  if (memory) return memory;
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.schemaVersion === SCHEMA_VERSION) {
        memory = parsed;
        return memory;
      }
    } catch {
      /* dữ liệu hỏng → khởi tạo lại */
    }
  }
  memory = await createSeedState();
  saveDb();
  return memory;
}

export function saveDb(): void {
  if (!memory) return;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* hết dung lượng hoặc bị chặn – vẫn chạy trong bộ nhớ */
  }
}

/** Khôi phục dữ liệu mẫu (NFR15 – phương án sao lưu/khôi phục trong môi trường thử). */
export async function resetDb(): Promise<void> {
  memory = await createSeedState();
  saveDb();
}

export function exportDb(): string {
  return JSON.stringify(memory, null, 2);
}

export function importDb(json: string): void {
  const parsed = JSON.parse(json) as DbState;
  if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.dishes)) throw new Error('Tệp sao lưu không hợp lệ.');
  memory = parsed;
  saveDb();
}

/** Dùng trong kiểm thử: nạp trực tiếp một trạng thái. */
export function setDbForTest(state: DbState): void {
  memory = state;
}
