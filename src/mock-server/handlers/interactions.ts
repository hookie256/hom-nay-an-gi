import type { FavoriteItem, HistoryItem } from '@/types/api';
import type { ActivityEventType } from '@/types/models';
import { normalizeText } from '@/domain/text';
import { route } from '../router';
import { Errors } from '../errors';
import { newId } from '../crypto';
import { paginate, ratingMap, requireUser, str, toDishCard } from '../helpers';

// ---------- UC34–UC36 Món yêu thích ----------
route('GET', '/favorites', (ctx) => {
  const user = requireUser(ctx);
  const q = normalizeText(ctx.query.get('q') ?? '');
  const ratings = ratingMap(ctx.db);
  const items: FavoriteItem[] = ctx.db.favorites
    .filter((f) => f.userId === user._id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => {
      const dish = ctx.db.dishes.find((d) => d._id === f.dishId);
      const available = dish?.status === 'published';
      return {
        dishId: f.dishId, createdAt: f.createdAt, available, name: dish?.name ?? 'Món không còn tồn tại',
        dish: dish && available ? toDishCard(ctx.db, dish, ctx.now, { ratings, favoriteIds: new Set([dish._id]) }) : null,
      };
    })
    .filter((f) => !q || normalizeText(f.name).includes(q));
  return paginate(items, ctx.query, 12);
});

route('POST', '/favorites', (ctx) => {
  const user = requireUser(ctx);
  const dishId = str(ctx.body?.dishId);
  const dish = ctx.db.dishes.find((d) => d._id === dishId);
  // Chỉ món đã xuất bản mới được lưu mới (6.10)
  if (!dish || dish.status !== 'published') throw Errors.dishUnavailable();
  // Cặp (userId, dishId) duy nhất – thao tác lặp không tạo trùng
  if (!ctx.db.favorites.some((f) => f.userId === user._id && f.dishId === dishId)) {
    ctx.db.favorites.push({ _id: newId(), userId: user._id, dishId, createdAt: ctx.now.toISOString() });
  }
  return { isFavorite: true };
});

route('DELETE', '/favorites/:dishId', (ctx) => {
  const user = requireUser(ctx);
  // Đã bỏ lưu trước đó thì không báo lỗi (UC35)
  ctx.db.favorites = ctx.db.favorites.filter((f) => !(f.userId === user._id && f.dishId === ctx.params.dishId));
  return { isFavorite: false };
});

// ---------- UC37–UC40 Đánh giá ----------
function validateReview(body: unknown): { rating: number; body?: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const fe: Record<string, string> = {};
  const rating = b.rating;
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) fe.rating = 'Vui lòng chọn số sao từ 1 đến 5.';
  const text = str(b.body).trim();
  if (text.length > 1000) fe.body = 'Nhận xét tối đa 1000 ký tự.';
  if (Object.keys(fe).length) throw Errors.validation(fe);
  return { rating: rating as number, body: text || undefined };
}

route('GET', '/dishes/:id/my-review', (ctx) => {
  const user = requireUser(ctx);
  const dish = ctx.db.dishes.find((d) => d._id === ctx.params.id || d.slug === ctx.params.id);
  if (!dish) throw Errors.dishUnavailable();
  return { review: ctx.db.reviews.find((r) => r.userId === user._id && r.dishId === dish._id) ?? null };
});

route('POST', '/reviews', (ctx) => {
  const user = requireUser(ctx);
  const dishId = str(ctx.body?.dishId);
  const dish = ctx.db.dishes.find((d) => d._id === dishId);
  if (!dish || dish.status !== 'published') throw Errors.dishUnavailable();
  const v = validateReview(ctx.body);
  // Mỗi người dùng tối đa một đánh giá cho một món
  if (ctx.db.reviews.some((r) => r.userId === user._id && r.dishId === dishId)) {
    throw Errors.conflict('REVIEW_EXISTS', 'Bạn đã đánh giá món này. Hãy sửa đánh giá đã có.');
  }
  const now = ctx.now.toISOString();
  const review = { _id: newId(), userId: user._id, dishId, ...v, moderationStatus: 'pending' as const, createdAt: now, updatedAt: now };
  ctx.db.reviews.push(review);
  return { review };
});

route('PATCH', '/reviews/:id', (ctx) => {
  const user = requireUser(ctx);
  const review = ctx.db.reviews.find((r) => r._id === ctx.params.id);
  if (!review) throw Errors.notFound('Đánh giá');
  if (review.userId !== user._id) throw Errors.forbidden();
  const v = validateReview(ctx.body);
  // Đánh giá vừa sửa phải qua kiểm duyệt lại (6.11)
  Object.assign(review, v, { moderationStatus: 'pending', updatedAt: ctx.now.toISOString() });
  if (!v.body) delete review.body;
  return { review };
});

route('DELETE', '/reviews/:id', (ctx) => {
  const user = requireUser(ctx);
  const review = ctx.db.reviews.find((r) => r._id === ctx.params.id);
  if (!review) throw Errors.notFound('Đánh giá');
  if (review.userId !== user._id) throw Errors.forbidden();
  ctx.db.reviews = ctx.db.reviews.filter((r) => r._id !== review._id);
  ctx.db.review_reports = ctx.db.review_reports.filter((r) => r.reviewId !== review._id);
  return { ok: true };
});

route('POST', '/reviews/:id/reports', (ctx) => {
  const user = requireUser(ctx);
  const review = ctx.db.reviews.find((r) => r._id === ctx.params.id && r.moderationStatus === 'published');
  if (!review) throw Errors.notFound('Nhận xét');
  if (review.userId === user._id) throw Errors.badRequest('OWN_REVIEW', 'Bạn không thể báo cáo nhận xét của chính mình.');
  const reason = str(ctx.body?.reason).trim();
  if (!reason) throw Errors.validation({ reason: 'Vui lòng chọn lý do báo cáo.' });
  if (reason.length > 300) throw Errors.validation({ reason: 'Lý do tối đa 300 ký tự.' });
  // Không tạo báo cáo trùng khi báo cáo trước vẫn đang chờ (UC40)
  const dup = ctx.db.review_reports.find((r) => r.reviewId === review._id && r.reporterId === user._id && r.status === 'open');
  if (dup) return { duplicate: true, message: 'Chúng tôi đã nhận báo cáo của bạn cho nhận xét này và đang xử lý.' };
  ctx.db.review_reports.push({ _id: newId(), reviewId: review._id, reporterId: user._id, reason, status: 'open', createdAt: ctx.now.toISOString(), resolvedBy: null, resolvedAt: null });
  return { duplicate: false, message: 'Đã gửi báo cáo. Quản trị viên sẽ xem xét nhận xét này.' };
});

// ---------- UC41–UC43 Lịch sử hoạt động ----------
route('GET', '/history', (ctx) => {
  const user = requireUser(ctx);
  const type = ctx.query.get('type') as ActivityEventType | null;
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');
  const items: HistoryItem[] = ctx.db.activity_events
    .filter((e) => e.userId === user._id)
    .filter((e) => !type || e.eventType === type)
    .filter((e) => !from || e.createdAt >= from)
    .filter((e) => !to || e.createdAt <= `${to}T23:59:59.999Z`)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => {
      const d = ctx.db.dishes.find((x) => x._id === e.dishId);
      return {
        _id: e._id, eventType: e.eventType, createdAt: e.createdAt,
        dish: { _id: e.dishId, slug: d?.slug ?? '', name: d?.name ?? 'Món không còn tồn tại', available: d?.status === 'published', image: d?.images[0] },
      };
    });
  const profile = ctx.db.user_profiles.find((p) => p.userId === user._id);
  return { ...paginate(items, ctx.query, 20), saveHistory: !!profile?.saveHistory };
});

route('DELETE', '/history/:id', (ctx) => {
  const user = requireUser(ctx);
  const ev = ctx.db.activity_events.find((e) => e._id === ctx.params.id);
  if (!ev || ev.userId !== user._id) throw Errors.notFound('Mục lịch sử');
  ctx.db.activity_events = ctx.db.activity_events.filter((e) => e._id !== ev._id);
  return { ok: true };
});

route('DELETE', '/history', (ctx) => {
  const user = requireUser(ctx);
  const before = ctx.db.activity_events.length;
  ctx.db.activity_events = ctx.db.activity_events.filter((e) => e.userId !== user._id);
  // Dữ liệu đã xóa không tiếp tục tham gia cá nhân hóa: gỡ liên kết người dùng khỏi lượt gợi ý cũ
  ctx.db.recommendation_events.forEach((r) => r.userId === user._id && (r.userId = null));
  ctx.db.search_events.forEach((s) => s.userId === user._id && delete s.userId);
  return { deleted: before - ctx.db.activity_events.length };
});
