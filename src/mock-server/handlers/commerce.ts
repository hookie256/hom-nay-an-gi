import type { CartView, OrderDetail } from '@/types/api';
import type { Cart, Order, OrderStatus } from '@/types/models';
import { validateCart, type CartIssue } from '@/domain/cartValidation';
import { checkOrderable, NOT_ORDERABLE_MESSAGE } from '@/domain/selling';
import { paymentAfterCancellation, userCancelMode } from '@/domain/orderStateMachine';
import { PHONE_RE } from '@/domain/text';
import { route, type Ctx } from '../router';
import { ApiError, Errors } from '../errors';
import { newId } from '../crypto';
import { paginate, requireUser, str } from '../helpers';

const fmt = (n: number) => `${n.toLocaleString('vi-VN')} đ`;

function cartOf(ctx: Ctx): Cart {
  const user = requireUser(ctx);
  let cart = ctx.db.carts.find((c) => c.userId === user._id);
  if (!cart) {
    cart = { _id: newId(), userId: user._id, items: [], updatedAt: ctx.now.toISOString() };
    ctx.db.carts.push(cart);
  }
  return cart;
}

function issueMessage(i: CartIssue): string {
  switch (i.type) {
    case 'price_changed':
      return `Giá đã thay đổi từ ${fmt(i.oldPrice)} thành ${fmt(i.newPrice)}. Vui lòng xác nhận giá mới.`;
    case 'not_orderable':
      return NOT_ORDERABLE_MESSAGE[i.reason];
    case 'invalid_quantity':
      return `Số lượng phải từ 1 đến ${i.max}.`;
  }
}

function buildCartView(ctx: Ctx, cart: Cart): CartView {
  const dishById = new Map(ctx.db.dishes.map((d) => [d._id, d]));
  const menuByDishId = new Map(ctx.db.selling_menus.map((m) => [m.dishId, m]));
  const v = validateCart(cart.items, { dishById, menuByDishId, settings: ctx.db.order_settings, now: ctx.now });
  return {
    items: v.lines.map((l) => {
      const d = dishById.get(l.dishId);
      const item = cart.items.find((i) => i.dishId === l.dishId);
      const issue = v.issues.find((i) => i.dishId === l.dishId);
      return {
        dishId: l.dishId, slug: d?.slug ?? '', name: l.name, image: d?.images[0], quantity: l.quantity, unitPrice: l.unitPrice,
        seenPrice: item?.seenPrice, lineTotal: l.lineTotal, orderable: l.orderable, issue: issue ? issueMessage(issue) : undefined,
      };
    }),
    subtotal: v.total,
    currency: 'VND',
    maxQuantityPerItem: ctx.db.order_settings.maxQuantityPerItem,
    issues: v.issues.map((i) => ({ dishId: i.dishId, type: i.type, message: issueMessage(i) })),
    ok: v.ok,
  };
}

// ---------- UC44–UC46 Giỏ hàng ----------
route('GET', '/cart', (ctx) => buildCartView(ctx, cartOf(ctx)));

route('POST', '/cart/items', (ctx) => {
  const cart = cartOf(ctx);
  const dishId = str(ctx.body?.dishId);
  const qty = ctx.body?.quantity ?? 1;
  const max = ctx.db.order_settings.maxQuantityPerItem;
  if (!Number.isInteger(qty) || qty < 1 || qty > max) throw Errors.validation({ quantity: `Số lượng phải từ 1 đến ${max}.` });
  const dish = ctx.db.dishes.find((d) => d._id === dishId);
  const menu = ctx.db.selling_menus.find((m) => m.dishId === dishId);
  const check = checkOrderable(menu, ctx.db.order_settings, ctx.now, dish?.status === 'published');
  if (!check.orderable) throw Errors.conflict('DISH_NOT_ORDERABLE', NOT_ORDERABLE_MESSAGE[check.reason]);
  const existing = cart.items.find((i) => i.dishId === dishId);
  if (existing) {
    if (existing.quantity + qty > max) throw Errors.validation({ quantity: `Mỗi món tối đa ${max} phần. Giỏ đã có ${existing.quantity} phần.` });
    existing.quantity += qty;
    existing.seenPrice = menu!.price;
  } else {
    cart.items.push({ dishId, quantity: qty, seenPrice: menu!.price });
  }
  cart.updatedAt = ctx.now.toISOString();
  return buildCartView(ctx, cart);
});

route('PATCH', '/cart/items/:dishId', (ctx) => {
  const cart = cartOf(ctx);
  const item = cart.items.find((i) => i.dishId === ctx.params.dishId);
  if (!item) throw Errors.notFound('Món trong giỏ');
  const qty = ctx.body?.quantity;
  const max = ctx.db.order_settings.maxQuantityPerItem;
  if (!Number.isInteger(qty) || qty < 0 || qty > max) throw Errors.validation({ quantity: `Số lượng phải từ 1 đến ${max}.` });
  if (qty === 0) cart.items = cart.items.filter((i) => i !== item);
  else item.quantity = qty;
  cart.updatedAt = ctx.now.toISOString();
  return buildCartView(ctx, cart);
});

route('DELETE', '/cart/items/:dishId', (ctx) => {
  const cart = cartOf(ctx);
  cart.items = cart.items.filter((i) => i.dishId !== ctx.params.dishId);
  cart.updatedAt = ctx.now.toISOString();
  return buildCartView(ctx, cart);
});

/** Người dùng xác nhận giá mới sau khi được thông báo thay đổi (UC46). */
route('POST', '/cart/confirm-prices', (ctx) => {
  const cart = cartOf(ctx);
  cart.items.forEach((i) => {
    const m = ctx.db.selling_menus.find((x) => x.dishId === i.dishId);
    if (m) i.seenPrice = m.price;
  });
  cart.updatedAt = ctx.now.toISOString();
  return buildCartView(ctx, cart);
});

route('POST', '/cart/remove-unavailable', (ctx) => {
  const cart = cartOf(ctx);
  const view = buildCartView(ctx, cart);
  const bad = new Set(view.items.filter((i) => !i.orderable).map((i) => i.dishId));
  cart.items = cart.items.filter((i) => !bad.has(i.dishId));
  cart.updatedAt = ctx.now.toISOString();
  return buildCartView(ctx, cart);
});

// ---------- UC47–UC49 Đặt hàng ----------
function toDetail(ctx: Ctx, o: Order): OrderDetail {
  return {
    ...o,
    events: ctx.db.order_events.filter((e) => e.orderId === o._id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    cancelMode: userCancelMode(o.orderStatus, o.cancelRequest?.status === 'pending'),
  };
}

route('POST', '/orders', (ctx) => {
  const user = requireUser(ctx);
  const b = ctx.body ?? {};
  const key = str(b.idempotencyKey);
  if (!key) throw Errors.badRequest('MISSING_IDEMPOTENCY_KEY', 'Thiếu mã yêu cầu.');
  // Một lần xác nhận chỉ tạo một đơn (RR07)
  const dup = ctx.db.orders.find((o) => o.userId === user._id && o.idempotencyKey === key);
  if (dup) return toDetail(ctx, dup);

  const ri = b.receiveInfo ?? {};
  const fe: Record<string, string> = {};
  const receiverName = str(ri.receiverName).trim();
  const phone = str(ri.phone).replace(/\s|\./g, '');
  const method = ri.method === 'pickup' ? 'pickup' : ri.method === 'delivery' ? 'delivery' : null;
  const address = str(ri.address).trim();
  if (!receiverName) fe['receiveInfo.receiverName'] = 'Vui lòng nhập tên người nhận.';
  if (!PHONE_RE.test(phone)) fe['receiveInfo.phone'] = 'Số điện thoại chưa đúng, ví dụ 0901234567.';
  if (!method) fe['receiveInfo.method'] = 'Vui lòng chọn hình thức nhận món.';
  if (method === 'delivery' && address.length < 10) fe['receiveInfo.address'] = 'Vui lòng nhập địa chỉ nhận món đầy đủ.';
  if (b.paymentMethod !== 'cod' && b.paymentMethod !== 'online') fe.paymentMethod = 'Vui lòng chọn hình thức thanh toán.';
  if (Object.keys(fe).length) throw Errors.validation(fe);
  if (b.paymentMethod === 'online') {
    throw Errors.badRequest('PAYMENT_METHOD_UNAVAILABLE', 'Thanh toán trực tuyến chưa được tích hợp. Vui lòng chọn thanh toán khi nhận món.');
  }

  const cart = cartOf(ctx);
  if (cart.items.length === 0) throw Errors.badRequest('CART_EMPTY', 'Giỏ hàng đang trống.');
  // UC46: kiểm tra lại giỏ – giá luôn lấy tại máy chủ
  const view = buildCartView(ctx, cart);
  if (!view.ok) {
    const err = new ApiError(409, 'CART_CHANGED', 'Giỏ hàng có thay đổi về giá hoặc tình trạng món. Vui lòng xem lại trước khi đặt.');
    throw err;
  }
  const now = ctx.now.toISOString();
  const items = view.items.map((l) => ({ dishId: l.dishId, snapshotName: l.name, unitPrice: l.unitPrice!, quantity: l.quantity, lineTotal: l.lineTotal! }));
  const order: Order = {
    _id: newId(),
    code: `HNAG-${String(100 + ctx.db.orders.length + 1)}${Math.floor(ctx.now.getTime() / 1000) % 1000}`,
    userId: user._id,
    items,
    total: items.reduce((s, i) => s + i.lineTotal, 0),
    currency: 'VND',
    receiveInfo: { receiverName, phone, method: method!, ...(method === 'delivery' ? { address } : {}), ...(str(ri.note).trim() ? { note: str(ri.note).trim().slice(0, 300) } : {}) },
    orderStatus: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'cod',
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.orders.push(order);
  ctx.db.order_events.push({ _id: newId(), orderId: order._id, fromStatus: null, toStatus: 'pending', actorId: user._id, createdAt: now });
  // Sau khi tạo đơn thành công mới xóa các món đã đặt khỏi giỏ
  const ordered = new Set(items.map((i) => i.dishId));
  cart.items = cart.items.filter((i) => !ordered.has(i.dishId));
  cart.updatedAt = now;
  return toDetail(ctx, order);
});

// ---------- UC50–UC52 Theo dõi đơn ----------
route('GET', '/orders', (ctx) => {
  const user = requireUser(ctx);
  const status = ctx.query.get('status') as OrderStatus | null;
  const list = ctx.db.orders
    .filter((o) => o.userId === user._id && (!status || o.orderStatus === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(list, ctx.query, 10);
});

function ownOrder(ctx: Ctx): Order {
  const user = requireUser(ctx);
  const order = ctx.db.orders.find((o) => o._id === ctx.params.id || o.code === ctx.params.id);
  // Không tiết lộ đơn của tài khoản khác (NFR07)
  if (!order || order.userId !== user._id) throw Errors.notFound('Đơn hàng');
  return order;
}

route('GET', '/orders/:id', (ctx) => toDetail(ctx, ownOrder(ctx)));

route('POST', '/orders/:id/cancel', (ctx) => {
  const order = ownOrder(ctx);
  const reason = str(ctx.body?.reason).trim();
  if (!reason) throw Errors.validation({ reason: 'Vui lòng nhập lý do hủy.' });
  if (reason.length > 300) throw Errors.validation({ reason: 'Lý do tối đa 300 ký tự.' });
  // Trạng thái được kiểm tra lại tại thời điểm gửi
  const mode = userCancelMode(order.orderStatus, order.cancelRequest?.status === 'pending');
  const now = ctx.now.toISOString();
  if (mode === 'not_allowed') throw Errors.conflict('CANCEL_NOT_ALLOWED', 'Đơn đã được chuẩn bị hoặc đã kết thúc nên không thể hủy.');
  if (mode === 'direct') {
    const from = order.orderStatus;
    order.orderStatus = 'cancelled';
    order.paymentStatus = paymentAfterCancellation(order.paymentStatus);
    order.cancelRequest = { reason, requestedAt: now, status: 'approved', decisionReason: 'Đơn chưa được tiếp nhận nên được hủy ngay.', decidedAt: now };
    order.updatedAt = now;
    ctx.db.order_events.push({ _id: newId(), orderId: order._id, fromStatus: from, toStatus: 'cancelled', actorId: ctx.user!._id, reason, createdAt: now });
    return { result: 'cancelled', order: toDetail(ctx, order) };
  }
  order.cancelRequest = { reason, requestedAt: now, status: 'pending' };
  order.updatedAt = now;
  return { result: 'requested', order: toDetail(ctx, order) };
});
