import type {
  AdminAuditRow, AdminOrderRow, AdminReportRow, AdminReviewRow, AdminUserRow, OrderDetail, SellingMenuRow, StatsOverview,
  StatsRecommendation, StatsTop,
} from '@/types/api';
import type { OrderStatus, Role, SellingMenu, TimeRange } from '@/types/models';
import { checkOrderable, NOT_ORDERABLE_MESSAGE, validateTimeRanges } from '@/domain/selling';
import { canAdminSetPayment, canAdminTransition, paymentAfterCancellation, userCancelMode } from '@/domain/orderStateMachine';
import { normalizeText } from '@/domain/text';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/domain/constants';
import { route, type Ctx } from '../router';
import { Errors } from '../errors';
import { newId } from '../crypto';
import { audit, paginate, requireAdmin, requireRole, str, toPublicUser } from '../helpers';

const emailOf = (ctx: Ctx, id?: string | null) => (id ? ctx.db.users.find((u) => u._id === id)?.email ?? '(đã xóa)' : '');

// ================= Quản lý người dùng (UC67–UC70) =================
route('GET', '/admin/users', (ctx) => {
  requireAdmin(ctx);
  const q = normalizeText(ctx.query.get('q') ?? '');
  const role = ctx.query.get('role');
  const status = ctx.query.get('status');
  const list: AdminUserRow[] = ctx.db.users
    .filter((u) => (!q || u.email.includes(q) || normalizeText(ctx.db.user_profiles.find((p) => p.userId === u._id)?.displayName ?? '').includes(q)) && (!role || u.role === role) && (!status || u.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((u) => toPublicUser(ctx.db, u));
  return paginate(list, ctx.query, 15);
});

route('PATCH', '/admin/users/:id/status', (ctx) => {
  const actor = requireAdmin(ctx);
  const target = ctx.db.users.find((u) => u._id === ctx.params.id);
  if (!target) throw Errors.notFound('Tài khoản');
  const status = ctx.body?.status;
  const reason = str(ctx.body?.reason).trim();
  if (status !== 'active' && status !== 'locked') throw Errors.validation({ status: 'Trạng thái không hợp lệ.' });
  if (!reason) throw Errors.validation({ reason: 'Vui lòng nhập lý do.' });
  if (target._id === actor._id) throw Errors.conflict('SELF_LOCK', 'Không thể tự khóa tài khoản đang sử dụng.');
  // Admin thường không được khóa quản trị viên khác; chỉ super_admin
  if (target.role !== 'user' && actor.role !== 'super_admin') throw Errors.forbidden();
  // Kiểm tra trạng thái tại thời điểm xử lý để không ghi đè thay đổi của người khác
  if (ctx.body?.expectedStatus && ctx.body.expectedStatus !== target.status) throw Errors.conflict('STALE_STATE', 'Trạng thái tài khoản vừa được thay đổi bởi quản trị viên khác. Vui lòng tải lại.');
  if (target.status === status) return { user: toPublicUser(ctx.db, target) };
  const before = { status: target.status };
  target.status = status;
  target.updatedAt = ctx.now.toISOString();
  if (status === 'locked') {
    // Thu hồi các phiên đang hoạt động
    ctx.db.sessions.filter((s) => s.userId === target._id && !s.revokedAt).forEach((s) => (s.revokedAt = ctx.now.toISOString()));
  }
  audit(ctx, 'user', target._id, status === 'locked' ? 'lock_user' : 'unlock_user', before, { status }, reason);
  return { user: toPublicUser(ctx.db, target) };
});

route('PATCH', '/admin/users/:id/role', (ctx) => {
  const actor = requireRole(ctx, ['super_admin']);
  const target = ctx.db.users.find((u) => u._id === ctx.params.id);
  if (!target) throw Errors.notFound('Tài khoản');
  const role = ctx.body?.role as Role;
  const reason = str(ctx.body?.reason).trim();
  if (!['user', 'admin', 'super_admin'].includes(role)) throw Errors.validation({ role: 'Vai trò không hợp lệ.' });
  if (!reason) throw Errors.validation({ reason: 'Vui lòng nhập lý do.' });
  if (target.role === role) return { user: toPublicUser(ctx.db, target) };
  // Không thu hồi quyền của super_admin cuối cùng (6.20)
  if (target.role === 'super_admin' && ctx.db.users.filter((u) => u.role === 'super_admin' && u.status === 'active').length <= 1) {
    throw Errors.conflict('LAST_SUPER_ADMIN', 'Không thể thu hồi quyền của quản trị viên cấp cao cuối cùng.');
  }
  void actor;
  const before = { role: target.role };
  target.role = role;
  target.updatedAt = ctx.now.toISOString();
  audit(ctx, 'user', target._id, 'change_role', before, { role }, reason);
  return { user: toPublicUser(ctx.db, target) };
});

route('GET', '/admin/audit-logs', (ctx) => {
  requireRole(ctx, ['super_admin']);
  const actor = normalizeText(ctx.query.get('actor') ?? '');
  const action = ctx.query.get('action');
  const targetType = ctx.query.get('targetType');
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');
  const list: AdminAuditRow[] = ctx.db.admin_audit_logs
    .map((l) => ({ ...l, actorEmail: emailOf(ctx, l.actorId) }))
    .filter((l) => (!actor || l.actorEmail.includes(actor)) && (!action || l.action === action) && (!targetType || l.targetType === targetType) &&
      (!from || l.createdAt >= from) && (!to || l.createdAt <= `${to}T23:59:59.999Z`))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b._id.localeCompare(a._id));
  const actions = Array.from(new Set(ctx.db.admin_audit_logs.map((l) => l.action))).sort();
  return { ...paginate(list, ctx.query, 20), actions };
});

// ================= Kiểm duyệt đánh giá (UC71–UC73) =================
route('GET', '/admin/reviews', (ctx) => {
  requireAdmin(ctx);
  const status = ctx.query.get('status');
  const dishQ = normalizeText(ctx.query.get('dish') ?? '');
  const list: AdminReviewRow[] = ctx.db.reviews
    .map((r) => ({
      ...r,
      dishName: ctx.db.dishes.find((d) => d._id === r.dishId)?.name ?? '(món đã xóa)',
      authorEmail: emailOf(ctx, r.userId),
      openReports: ctx.db.review_reports.filter((p) => p.reviewId === r._id && p.status === 'open').length,
    }))
    .filter((r) => (!status || r.moderationStatus === status) && (!dishQ || normalizeText(r.dishName).includes(dishQ)))
    .sort((a, b) => b.openReports - a.openReports || b.updatedAt.localeCompare(a.updatedAt));
  return paginate(list, ctx.query, 15);
});

route('PATCH', '/admin/reviews/:id', (ctx) => {
  requireAdmin(ctx);
  const review = ctx.db.reviews.find((r) => r._id === ctx.params.id);
  if (!review) throw Errors.notFound('Đánh giá');
  const status = ctx.body?.moderationStatus;
  const reason = str(ctx.body?.reason).trim();
  if (status !== 'published' && status !== 'hidden') throw Errors.validation({ moderationStatus: 'Trạng thái không hợp lệ.' });
  if (status === 'hidden' && !reason) throw Errors.validation({ reason: 'Vui lòng ghi lý do ẩn.' });
  // Trạng thái đã đổi bởi người khác thì yêu cầu tải lại (UC72)
  if (ctx.body?.expectedStatus && ctx.body.expectedStatus !== review.moderationStatus) throw Errors.conflict('STALE_STATE', 'Đánh giá vừa được người khác xử lý. Vui lòng tải lại.');
  const before = { moderationStatus: review.moderationStatus };
  Object.assign(review, { moderationStatus: status, moderationReason: reason || undefined, moderatedBy: ctx.user!._id, moderatedAt: ctx.now.toISOString() });
  audit(ctx, 'review', review._id, status === 'published' ? 'approve_review' : 'hide_review', before, { moderationStatus: status }, reason || undefined);
  return { review };
});

route('GET', '/admin/review-reports', (ctx) => {
  requireAdmin(ctx);
  const status = ctx.query.get('status') ?? 'open';
  const list: AdminReportRow[] = ctx.db.review_reports
    .filter((r) => status === 'all' || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const rv = ctx.db.reviews.find((x) => x._id === r.reviewId);
      return {
        _id: r._id, reason: r.reason, status: r.status, resolution: r.resolution, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
        resolvedByEmail: emailOf(ctx, r.resolvedBy), reporterEmail: emailOf(ctx, r.reporterId),
        review: rv ? { _id: rv._id, body: rv.body, rating: rv.rating, moderationStatus: rv.moderationStatus, dishName: ctx.db.dishes.find((d) => d._id === rv.dishId)?.name ?? '' } : null,
      };
    });
  return paginate(list, ctx.query, 15);
});

route('POST', '/admin/review-reports/:id/resolve', (ctx) => {
  requireAdmin(ctx);
  const report = ctx.db.review_reports.find((r) => r._id === ctx.params.id);
  if (!report) throw Errors.notFound('Báo cáo');
  // Báo cáo đã xử lý không được xử lý lại như báo cáo mới
  if (report.status !== 'open') throw Errors.conflict('ALREADY_RESOLVED', 'Báo cáo này đã được xử lý.');
  const decision = ctx.body?.decision;
  const note = str(ctx.body?.note).trim();
  if (decision !== 'keep' && decision !== 'hide') throw Errors.validation({ decision: 'Vui lòng chọn giữ hoặc ẩn nhận xét.' });
  const review = ctx.db.reviews.find((r) => r._id === report.reviewId);
  const now = ctx.now.toISOString();
  if (decision === 'hide' && review) {
    review.moderationStatus = 'hidden';
    review.moderationReason = note || `Vi phạm: ${report.reason}`;
    review.moderatedBy = ctx.user!._id;
    review.moderatedAt = now;
  }
  // Đóng mọi báo cáo đang mở cho cùng nhận xét
  ctx.db.review_reports.filter((r) => r.reviewId === report.reviewId && r.status === 'open').forEach((r) => {
    Object.assign(r, { status: decision === 'hide' ? 'resolved' : 'rejected', resolution: decision === 'hide' ? 'hidden' : 'kept', resolvedBy: ctx.user!._id, resolvedAt: now });
  });
  audit(ctx, 'review', report.reviewId, decision === 'hide' ? 'resolve_report_hide' : 'resolve_report_keep', { reportId: report._id }, { decision }, note || undefined);
  return { ok: true };
});

// ================= Thực đơn bán hàng (UC77–UC79) =================
function parseHours(v: unknown): TimeRange[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw Errors.validation({ receivingHours: 'Khung giờ không hợp lệ.' });
  const ranges = v.map((r) => ({ start: str(r?.start), end: str(r?.end) }));
  if (ranges.length === 0) return [];
  const err = validateTimeRanges(ranges);
  if (err) throw Errors.validation({ receivingHours: err });
  return ranges;
}

function menuRow(ctx: Ctx, m: SellingMenu): SellingMenuRow {
  const dish = ctx.db.dishes.find((d) => d._id === m.dishId);
  const check = checkOrderable(m, ctx.db.order_settings, ctx.now, dish?.status === 'published');
  return { ...m, dishName: dish?.name ?? '(món đã xóa)', dishSlug: dish?.slug ?? '', dishStatus: dish?.status ?? 'hidden', orderableNow: check.orderable, reason: check.orderable ? undefined : NOT_ORDERABLE_MESSAGE[check.reason] };
}

route('GET', '/admin/selling-menus', (ctx) => {
  requireAdmin(ctx);
  return { items: ctx.db.selling_menus.map((m) => menuRow(ctx, m)), settings: ctx.db.order_settings };
});

function parsePrice(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || !Number.isInteger(v)) throw Errors.validation({ price: 'Giá phải là số nguyên dương (đồng).' });
  if (v > 10_000_000) throw Errors.validation({ price: 'Giá vượt quá giới hạn cho phép.' });
  return v;
}

route('POST', '/admin/selling-menus', (ctx) => {
  requireAdmin(ctx);
  const dishId = str(ctx.body?.dishId);
  const dish = ctx.db.dishes.find((d) => d._id === dishId);
  // Chỉ món đã xuất bản và có giá hợp lệ mới được bật bán
  if (!dish || dish.status !== 'published') throw Errors.validation({ dishId: 'Chỉ món đã xuất bản mới được bật bán.' });
  if (ctx.db.selling_menus.some((m) => m.dishId === dishId)) throw Errors.conflict('MENU_EXISTS', 'Món đã có trong thực đơn bán hàng.');
  const price = parsePrice(ctx.body?.price);
  const receivingHours = parseHours(ctx.body?.receivingHours);
  const now = ctx.now.toISOString();
  const menu: SellingMenu = { _id: newId(), dishId, price, currency: 'VND', available: ctx.body?.available !== false, receivingHours, validFrom: now, validTo: null, createdAt: now, updatedAt: now };
  ctx.db.selling_menus.push(menu);
  audit(ctx, 'selling_menu', menu._id, 'enable_selling', undefined, { dishId, price, available: menu.available });
  return { menu: menuRow(ctx, menu) };
});

route('PATCH', '/admin/selling-menus/:id', (ctx) => {
  requireAdmin(ctx);
  const menu = ctx.db.selling_menus.find((m) => m._id === ctx.params.id);
  if (!menu) throw Errors.notFound('Mục bán');
  const b = ctx.body ?? {};
  const before = { price: menu.price, available: menu.available, receivingHours: menu.receivingHours };
  if ('price' in b) menu.price = parsePrice(b.price);
  if ('available' in b) {
    if (b.available && ctx.db.dishes.find((d) => d._id === menu.dishId)?.status !== 'published') throw Errors.conflict('DISH_NOT_PUBLISHED', 'Món chưa được xuất bản nên không thể mở bán.');
    menu.available = !!b.available;
  }
  if ('receivingHours' in b) menu.receivingHours = parseHours(b.receivingHours);
  menu.updatedAt = ctx.now.toISOString();
  const action = before.price !== menu.price ? 'update_price' : before.available !== menu.available ? (menu.available ? 'resume_selling' : 'pause_selling') : 'update_selling_hours';
  audit(ctx, 'selling_menu', menu._id, action, before, { price: menu.price, available: menu.available, receivingHours: menu.receivingHours });
  return { menu: menuRow(ctx, menu) };
});

route('DELETE', '/admin/selling-menus/:id', (ctx) => {
  requireAdmin(ctx);
  const menu = ctx.db.selling_menus.find((m) => m._id === ctx.params.id);
  if (!menu) throw Errors.notFound('Mục bán');
  ctx.db.selling_menus = ctx.db.selling_menus.filter((m) => m._id !== menu._id);
  audit(ctx, 'selling_menu', menu._id, 'disable_selling', { dishId: menu.dishId, price: menu.price });
  return { ok: true };
});

route('PUT', '/admin/order-settings', (ctx) => {
  requireAdmin(ctx);
  const hours = parseHours(ctx.body?.defaultReceivingHours);
  if (!hours || hours.length === 0) throw Errors.validation({ receivingHours: 'Cần ít nhất một khung giờ nhận đơn.' });
  const tz = str(ctx.body?.timezone) || ctx.db.order_settings.timezone;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    throw Errors.validation({ timezone: 'Múi giờ không hợp lệ.' });
  }
  const max = ctx.body?.maxQuantityPerItem ?? ctx.db.order_settings.maxQuantityPerItem;
  if (!Number.isInteger(max) || max < 1 || max > 100) throw Errors.validation({ maxQuantityPerItem: 'Giới hạn phải từ 1 đến 100.' });
  const before = { ...ctx.db.order_settings };
  ctx.db.order_settings = { timezone: tz, defaultReceivingHours: hours, maxQuantityPerItem: max, updatedAt: ctx.now.toISOString() };
  audit(ctx, 'settings', 'order_settings', 'update_order_settings', before as unknown as Record<string, unknown>, ctx.db.order_settings as unknown as Record<string, unknown>);
  return { settings: ctx.db.order_settings };
});

// ================= Quản lý & xử lý đơn hàng (UC80–UC83) =================
const GROUPS: Record<string, OrderStatus[]> = { new: ['pending'], processing: ['confirmed', 'preparing'], done: ['completed', 'rejected', 'cancelled'] };

route('GET', '/admin/orders', (ctx) => {
  requireAdmin(ctx);
  const group = ctx.query.get('group') ?? 'new';
  const q = (ctx.query.get('q') ?? '').trim().toUpperCase();
  const statuses = GROUPS[group] ?? GROUPS.new;
  const list: AdminOrderRow[] = ctx.db.orders
    .filter((o) => statuses.includes(o.orderStatus) && (!q || o.code.includes(q)))
    .sort((a, b) => (group === 'done' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
    .map((o) => ({ ...o, userEmail: emailOf(ctx, o.userId) }));
  const counts = Object.fromEntries(Object.entries(GROUPS).map(([k, st]) => [k, ctx.db.orders.filter((o) => st.includes(o.orderStatus)).length]));
  const cancelRequests = ctx.db.orders.filter((o) => o.cancelRequest?.status === 'pending').length;
  return { ...paginate(list, ctx.query, 15), counts, cancelRequests };
});

function adminOrderDetail(ctx: Ctx, id: string): OrderDetail {
  const o = ctx.db.orders.find((x) => x._id === id);
  if (!o) throw Errors.notFound('Đơn hàng');
  return {
    ...o,
    userEmail: emailOf(ctx, o.userId),
    events: ctx.db.order_events.filter((e) => e.orderId === o._id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    cancelMode: userCancelMode(o.orderStatus, o.cancelRequest?.status === 'pending'),
  };
}

route('GET', '/admin/orders/:id', (ctx) => {
  requireAdmin(ctx);
  return adminOrderDetail(ctx, ctx.params.id);
});

route('PATCH', '/admin/orders/:id/status', (ctx) => {
  requireAdmin(ctx);
  const order = ctx.db.orders.find((o) => o._id === ctx.params.id);
  if (!order) throw Errors.notFound('Đơn hàng');
  const to = ctx.body?.toStatus as OrderStatus;
  const reason = str(ctx.body?.reason).trim();
  const expected = ctx.body?.expectedStatus as OrderStatus | undefined;
  // Thao tác gửi lặp: đơn đã ở trạng thái đích → không tạo sự kiện trùng
  if (order.orderStatus === to) return adminOrderDetail(ctx, order._id);
  // Hai quản trị viên cùng cập nhật: chỉ một kết quả hợp lệ
  if (expected && expected !== order.orderStatus) throw Errors.conflict('STALE_STATE', `Đơn đã được chuyển sang “${ORDER_STATUS_LABEL[order.orderStatus]}” bởi người khác. Vui lòng tải lại.`);
  if (!canAdminTransition(order.orderStatus, to)) throw Errors.conflict('INVALID_TRANSITION', `Không thể chuyển đơn từ “${ORDER_STATUS_LABEL[order.orderStatus]}” sang “${ORDER_STATUS_LABEL[to] ?? to}”.`);
  if (to === 'rejected' && !reason) throw Errors.validation({ reason: 'Vui lòng nhập lý do từ chối để báo cho người đặt.' });
  if (order.cancelRequest?.status === 'pending' && to === 'preparing') throw Errors.conflict('CANCEL_REQUEST_PENDING', 'Đơn đang có yêu cầu hủy. Hãy xử lý yêu cầu hủy trước.');
  const from = order.orderStatus;
  const beforePay = order.paymentStatus;
  order.orderStatus = to;
  if (to === 'rejected') {
    order.rejectReason = reason;
    order.paymentStatus = paymentAfterCancellation(order.paymentStatus);
  }
  order.updatedAt = ctx.now.toISOString();
  ctx.db.order_events.push({
    _id: newId(), orderId: order._id, fromStatus: from, toStatus: to, actorId: ctx.user!._id, reason: reason || undefined,
    note: beforePay !== order.paymentStatus ? `Thanh toán: ${PAYMENT_STATUS_LABEL[beforePay]} → ${PAYMENT_STATUS_LABEL[order.paymentStatus]}` : undefined,
    createdAt: ctx.now.toISOString(),
  });
  audit(ctx, 'order', order._id, `order_${to}`, { orderStatus: from }, { orderStatus: to }, reason || undefined);
  return adminOrderDetail(ctx, order._id);
});

route('POST', '/admin/orders/:id/cancel-request', (ctx) => {
  requireAdmin(ctx);
  const order = ctx.db.orders.find((o) => o._id === ctx.params.id);
  if (!order) throw Errors.notFound('Đơn hàng');
  if (order.cancelRequest?.status !== 'pending') throw Errors.conflict('NO_PENDING_REQUEST', 'Đơn không có yêu cầu hủy đang chờ xử lý.');
  const decision = ctx.body?.decision;
  const reason = str(ctx.body?.reason).trim();
  if (decision !== 'approve' && decision !== 'reject') throw Errors.validation({ decision: 'Vui lòng chọn chấp nhận hoặc từ chối.' });
  if (!reason) throw Errors.validation({ reason: 'Vui lòng nhập lý do.' });
  const now = ctx.now.toISOString();
  if (decision === 'approve') {
    // Đơn đã hoàn thành thì không hủy được
    if (order.orderStatus === 'completed' || order.orderStatus === 'rejected' || order.orderStatus === 'cancelled') {
      throw Errors.conflict('CANCEL_NOT_ALLOWED', 'Đơn đã kết thúc nên không thể hủy.');
    }
    const from = order.orderStatus;
    const beforePay = order.paymentStatus;
    order.orderStatus = 'cancelled';
    order.paymentStatus = paymentAfterCancellation(order.paymentStatus);
    ctx.db.order_events.push({
      _id: newId(), orderId: order._id, fromStatus: from, toStatus: 'cancelled', actorId: ctx.user!._id, reason,
      note: beforePay !== order.paymentStatus ? `Thanh toán: ${PAYMENT_STATUS_LABEL[beforePay]} → ${PAYMENT_STATUS_LABEL[order.paymentStatus]}` : undefined, createdAt: now,
    });
  }
  order.cancelRequest = { ...order.cancelRequest, status: decision === 'approve' ? 'approved' : 'rejected', decisionReason: reason, decidedBy: ctx.user!._id, decidedAt: now };
  order.updatedAt = now;
  audit(ctx, 'order', order._id, decision === 'approve' ? 'approve_cancel' : 'reject_cancel', undefined, { orderStatus: order.orderStatus }, reason);
  return adminOrderDetail(ctx, order._id);
});

/** Ghi nhận thu tiền COD hoặc đã hoàn tiền – trạng thái thanh toán tách khỏi trạng thái đơn (5.12). */
route('PATCH', '/admin/orders/:id/payment', (ctx) => {
  requireAdmin(ctx);
  const order = ctx.db.orders.find((o) => o._id === ctx.params.id);
  if (!order) throw Errors.notFound('Đơn hàng');
  const to = ctx.body?.paymentStatus;
  if (order.paymentStatus === to) return adminOrderDetail(ctx, order._id);
  if (!canAdminSetPayment(order.paymentStatus, to)) throw Errors.conflict('INVALID_PAYMENT_TRANSITION', `Không thể chuyển thanh toán từ “${PAYMENT_STATUS_LABEL[order.paymentStatus]}” sang “${PAYMENT_STATUS_LABEL[to as keyof typeof PAYMENT_STATUS_LABEL] ?? to}”.`);
  if (to === 'paid' && ['rejected', 'cancelled'].includes(order.orderStatus)) throw Errors.conflict('ORDER_CLOSED', 'Đơn đã bị hủy/từ chối, không thể ghi nhận thu tiền.');
  const before = order.paymentStatus;
  order.paymentStatus = to;
  order.updatedAt = ctx.now.toISOString();
  ctx.db.order_events.push({ _id: newId(), orderId: order._id, fromStatus: order.orderStatus, toStatus: order.orderStatus, actorId: ctx.user!._id, note: `Thanh toán: ${PAYMENT_STATUS_LABEL[before]} → ${PAYMENT_STATUS_LABEL[order.paymentStatus]}`, createdAt: ctx.now.toISOString() });
  audit(ctx, 'order', order._id, 'update_payment', { paymentStatus: before }, { paymentStatus: to });
  return adminOrderDetail(ctx, order._id);
});

// ================= Thống kê (UC74–UC76) =================
function range(ctx: Ctx): { from: Date; to: Date } {
  const to = ctx.query.get('to') ? new Date(`${ctx.query.get('to')}T23:59:59.999Z`) : ctx.now;
  const from = ctx.query.get('from') ? new Date(`${ctx.query.get('from')}T00:00:00.000Z`) : new Date(to.getTime() - 29 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw Errors.validation({ from: 'Khoảng thời gian không hợp lệ.' });
  return { from, to };
}
const inRange = (iso: string, r: { from: Date; to: Date }) => {
  const t = Date.parse(iso);
  return t >= r.from.getTime() && t <= r.to.getTime();
};

route('GET', '/admin/stats/overview', (ctx): StatsOverview => {
  requireAdmin(ctx);
  const r = range(ctx);
  const views = ctx.db.dish_view_stats.filter((s) => inRange(`${s.date}T12:00:00.000Z`, r));
  const recs = ctx.db.recommendation_events.filter((e) => inRange(e.createdAt, r));
  const orders = ctx.db.orders.filter((o) => inRange(o.createdAt, r));
  const completed = orders.filter((o) => o.orderStatus === 'completed');
  const days: StatsOverview['daily'] = [];
  for (let t = new Date(r.from.toISOString().slice(0, 10)); t <= r.to; t = new Date(t.getTime() + 86400000)) {
    const d = t.toISOString().slice(0, 10);
    days.push({
      date: d,
      views: views.filter((v) => v.date === d).reduce((s, v) => s + v.views, 0),
      recommendations: recs.filter((e) => e.createdAt.startsWith(d)).length,
      orders: orders.filter((o) => o.createdAt.startsWith(d)).length,
    });
  }
  return {
    from: r.from.toISOString(), to: r.to.toISOString(),
    totalUsers: ctx.db.users.length,
    newUsers: ctx.db.users.filter((u) => inRange(u.createdAt, r)).length,
    publishedDishes: ctx.db.dishes.filter((d) => d.status === 'published').length,
    totalDishes: ctx.db.dishes.length,
    dishViews: views.reduce((s, v) => s + v.views, 0),
    distinctViewers: new Set(ctx.db.activity_events.filter((e) => e.eventType === 'view_dish' && inRange(e.createdAt, r)).map((e) => e.userId)).size,
    recommendations: recs.length,
    orders: orders.length,
    completedOrders: completed.length,
    revenueCompleted: completed.reduce((s, o) => s + o.total, 0),
    favoritesAdded: ctx.db.favorites.filter((f) => inRange(f.createdAt, r)).length,
    daily: days,
  };
});

route('GET', '/admin/stats/top', (ctx): StatsTop => {
  requireAdmin(ctx);
  const r = range(ctx);
  const views = new Map<string, number>();
  ctx.db.dish_view_stats.filter((s) => inRange(`${s.date}T12:00:00.000Z`, r)).forEach((s) => views.set(s.dishId, (views.get(s.dishId) ?? 0) + s.views));
  const favs = new Map<string, number>();
  ctx.db.favorites.filter((f) => inRange(f.createdAt, r)).forEach((f) => favs.set(f.dishId, (favs.get(f.dishId) ?? 0) + 1));
  const sugg = new Map<string, number>();
  ctx.db.recommendation_events.filter((e) => inRange(e.createdAt, r)).forEach((e) => e.suggestedDishIds.forEach((d) => sugg.set(d, (sugg.get(d) ?? 0) + 1)));
  const dishIds = new Set([...views.keys(), ...favs.keys(), ...sugg.keys()]);
  const dishes = Array.from(dishIds)
    .map((id) => ({ dishId: id, name: ctx.db.dishes.find((d) => d._id === id)?.name ?? '(đã xóa)', views: views.get(id) ?? 0, favorites: favs.get(id) ?? 0, suggested: sugg.get(id) ?? 0 }))
    .map((x) => ({ ...x, score: x.views + x.favorites * 3 }))
    .sort((a, b) => b.score - a.score || b.suggested - a.suggested)
    .slice(0, 10);
  const searches = ctx.db.search_events.filter((s) => inRange(s.createdAt, r));
  const kw = new Map<string, number>();
  searches.filter((s) => s.keyword).forEach((s) => { const k = normalizeText(s.keyword!); kw.set(k, (kw.get(k) ?? 0) + 1); });
  const ing = new Map<string, number>();
  searches.forEach((s) => s.ingredientIds?.forEach((i) => ing.set(i, (ing.get(i) ?? 0) + 1)));
  return {
    dishes,
    keywords: Array.from(kw, ([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    ingredients: Array.from(ing, ([ingredientId, count]) => ({ ingredientId, name: ctx.db.ingredients.find((i) => i._id === ingredientId)?.canonicalName ?? ingredientId, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    sampleSize: { searches: searches.filter((s) => s.keyword).length, ingredientSearches: searches.filter((s) => s.ingredientIds?.length).length },
  };
});

route('GET', '/admin/stats/recommendation', (ctx): StatsRecommendation => {
  requireAdmin(ctx);
  const r = range(ctx);
  const recs = ctx.db.recommendation_events.filter((e) => e.displayStatus === 'shown' && e.suggestedDishIds.length > 0 && inRange(e.createdAt, r));
  const shown = recs.length;
  const withOpen = recs.filter((e) => e.openedDishIds.length > 0).length;
  const withChoose = recs.filter((e) => !!e.chosenDishId).length;
  const rate = (n: number) => (shown === 0 ? null : Math.round((n / shown) * 1000) / 10);
  return {
    shown, withOpen, withChoose,
    // Chưa liên kết đơn hàng với mã lượt gợi ý → không hiển thị như kết quả đã đo (6.22)
    withOrder: null,
    openRate: rate(withOpen),
    chooseRate: rate(withChoose),
    orderRate: null,
    definitions: {
      shown: 'Số lượt hệ thống hiển thị ít nhất một món gợi ý trong khoảng thời gian (một lượt có thể gồm nhiều món).',
      openRate: 'Số lượt gợi ý có ít nhất một món được mở trang chi tiết ÷ tổng số lượt gợi ý. Đây là tỷ lệ theo lượt, không phải theo người dùng.',
      chooseRate: 'Số lượt gợi ý có hành động “Chọn món này” ÷ tổng số lượt gợi ý.',
      orderRate: 'Chưa có dữ liệu: đơn hàng chưa được liên kết với mã lượt gợi ý nên chưa đo được.',
    },
  };
});
