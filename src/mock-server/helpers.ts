import type { DishCard, Paginated, SellingInfo } from '@/types/api';
import type { AuditTargetType, Dish, Id, Ingredient, PublicUser, Role, User } from '@/types/models';
import { checkOrderable, effectiveHours, NOT_ORDERABLE_MESSAGE } from '@/domain/selling';
import { totalMinutes } from '@/domain/recommendation';
import { POPULAR_WINDOW_DAYS } from '@/domain/constants';
import type { DbState } from './db';
import type { Ctx } from './router';
import { Errors } from './errors';
import { newId } from './crypto';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
/** Còn dưới mức này thì tự gia hạn phiên (UC04 – làm mới phiên). */
export const SESSION_REFRESH_WINDOW_MS = 30 * 60 * 1000;

/** Xác thực phiên nếu có (UC06). Không ném lỗi khi khách chưa đăng nhập. */
export function optionalAuth(ctx: Ctx): User | undefined {
  if (!ctx.token) return undefined;
  const session = ctx.db.sessions.find((s) => s.token === ctx.token);
  if (!session || session.revokedAt) return undefined;
  if (Date.parse(session.expiresAt) <= ctx.now.getTime()) return undefined;
  const user = ctx.db.users.find((u) => u._id === session.userId);
  if (!user || user.status !== 'active') return undefined;
  ctx.user = user;
  ctx.session = session;
  return user;
}

/** Bắt buộc đăng nhập – kiểm tra phiên và trạng thái tài khoản tại “máy chủ” (NFR06). */
export function requireUser(ctx: Ctx): User {
  if (!ctx.token) throw Errors.unauthenticated();
  const session = ctx.db.sessions.find((s) => s.token === ctx.token);
  if (!session || session.revokedAt) throw Errors.sessionExpired();
  if (Date.parse(session.expiresAt) <= ctx.now.getTime()) throw Errors.sessionExpired();
  const user = ctx.db.users.find((u) => u._id === session.userId);
  if (!user) throw Errors.sessionExpired();
  if (user.status !== 'active') throw Errors.accountLocked();
  // UC04: phiên sắp hết hạn thì cấp thêm thời gian
  if (Date.parse(session.expiresAt) - ctx.now.getTime() < SESSION_REFRESH_WINDOW_MS) {
    session.expiresAt = new Date(ctx.now.getTime() + SESSION_TTL_MS).toISOString();
  }
  ctx.user = user;
  ctx.session = session;
  return user;
}

/** Kiểm tra vai trò – mọi tác vụ quản trị đều qua đây (NFR08). */
export function requireRole(ctx: Ctx, roles: Role[]): User {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) throw Errors.forbidden();
  return user;
}

export const requireAdmin = (ctx: Ctx) => requireRole(ctx, ['admin', 'super_admin']);

export function toPublicUser(db: DbState, u: User): PublicUser {
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  const profile = db.user_profiles.find((p) => p.userId === u._id);
  return { ...rest, displayName: profile?.displayName };
}

export function paginate<T>(items: T[], query: URLSearchParams, defaultSize = 12, maxSize = 50): Paginated<T> {
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(query.get('pageSize') ?? String(defaultSize), 10) || defaultSize));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length, hasMore: start + pageSize < items.length };
}

export function ingredientMap(db: DbState): Map<Id, Ingredient> {
  return new Map(db.ingredients.map((i) => [i._id, i]));
}

export function categoryNameMap(db: DbState): Map<Id, string> {
  return new Map(db.categories.map((c) => [c._id, c.name]));
}

/** Điểm trung bình chỉ tính từ đánh giá published (UC39). */
export function ratingMap(db: DbState): Map<Id, { avg: number; count: number }> {
  const acc = new Map<Id, { sum: number; count: number }>();
  for (const r of db.reviews) {
    if (r.moderationStatus !== 'published') continue;
    const a = acc.get(r.dishId) ?? { sum: 0, count: 0 };
    a.sum += r.rating;
    a.count += 1;
    acc.set(r.dishId, a);
  }
  return new Map(Array.from(acc, ([k, v]) => [k, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }]));
}

/** Chỉ số phổ biến = lượt lưu + lượt xem trong 30 ngày (giả định đã xác nhận). */
export function popularityMap(db: DbState, now: Date): Map<Id, number> {
  const since = now.getTime() - POPULAR_WINDOW_DAYS * 86400000;
  const m = new Map<Id, number>();
  const bump = (id: Id) => m.set(id, (m.get(id) ?? 0) + 1);
  db.activity_events.forEach((e) => e.eventType === 'view_dish' && Date.parse(e.createdAt) >= since && bump(e.dishId));
  db.favorites.forEach((f) => Date.parse(f.createdAt) >= since && bump(f.dishId));
  return m;
}

export function sellingInfo(db: DbState, dish: Dish, now: Date): SellingInfo | null {
  const menu = db.selling_menus.find((m) => m.dishId === dish._id);
  if (!menu) return null;
  const check = checkOrderable(menu, db.order_settings, now, dish.status === 'published');
  return {
    price: menu.price,
    currency: menu.currency,
    orderable: check.orderable,
    reason: check.orderable ? undefined : NOT_ORDERABLE_MESSAGE[check.reason],
    receivingHours: effectiveHours(menu, db.order_settings),
  };
}

export function toDishCard(
  db: DbState,
  dish: Dish,
  now: Date,
  opts: { ratings?: Map<Id, { avg: number; count: number }>; favoriteIds?: Set<Id> } = {},
): DishCard {
  const ratings = opts.ratings ?? ratingMap(db);
  return {
    _id: dish._id,
    slug: dish.slug,
    name: dish.name,
    description: dish.description,
    image: dish.images[0],
    prepMinutes: dish.prepMinutes,
    cookMinutes: dish.cookMinutes,
    totalMinutes: totalMinutes(dish),
    difficulty: dish.difficulty,
    mealSlotIds: dish.mealSlotIds,
    rating: ratings.get(dish._id) ?? null,
    selling: sellingInfo(db, dish, now),
    isFavorite: opts.favoriteIds ? opts.favoriteIds.has(dish._id) : undefined,
  };
}

export function favoriteIdsOf(db: DbState, userId?: Id): Set<Id> | undefined {
  if (!userId) return undefined;
  return new Set(db.favorites.filter((f) => f.userId === userId).map((f) => f.dishId));
}

/** Ghi nhật ký quản trị (NFR10); không bao giờ chứa mật khẩu/mã phiên. */
export function audit(
  ctx: Ctx,
  targetType: AuditTargetType,
  targetId: Id,
  action: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  reason?: string,
): void {
  const strip = (o?: Record<string, unknown>) => {
    if (!o) return undefined;
    const { passwordHash: _p, token: _t, ...rest } = o as Record<string, unknown> & { passwordHash?: unknown; token?: unknown };
    void _p;
    void _t;
    return rest;
  };
  ctx.db.admin_audit_logs.push({
    _id: newId(), actorId: ctx.user!._id, targetType, targetId, action, before: strip(before), after: strip(after),
    ...(reason ? { reason } : {}), createdAt: ctx.now.toISOString(),
  });
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  keys.forEach((k) => (out[k] = obj[k]));
  return out;
}

export function listParam(q: URLSearchParams, key: string): string[] {
  return q.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
}

export function intParam(q: URLSearchParams, key: string): number | undefined {
  const v = q.get(key);
  if (v === null || v === '') return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
