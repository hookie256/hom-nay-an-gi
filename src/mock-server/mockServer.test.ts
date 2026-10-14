import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest } from './index';
import { createSeedState, setDbForTest, type DbState } from './db';

const NOW = new Date('2026-10-14T05:00:00Z'); // 12:00 giờ Việt Nam – trong giờ nhận đơn
let db: DbState;

const call = (method: string, url: string, body?: unknown, token: string | null = null) => handleRequest(method, url, body, token, NOW);
async function login(email: string, password = 'User@123') {
  const r = await call('POST', '/api/auth/login', { email, password });
  return (r.body as { token: string }).token;
}

beforeEach(async () => {
  db = await createSeedState(NOW);
  setDbForTest(db);
});

describe('Tài khoản & phân quyền', () => {
  it('không cho đăng ký trùng email (chuẩn hóa chữ hoa/khoảng trắng)', async () => {
    const r = await call('POST', '/api/auth/register', { name: 'X', email: '  AN@homnayangi.test ', password: 'abc12345' });
    expect(r.status).toBe(422);
    expect((r.body as { fieldErrors: Record<string, string> }).fieldErrors.email).toBeDefined();
  });
  it('tài khoản bị khóa không đăng nhập được', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'khoa@homnayangi.test', password: 'User@123' });
    expect(r.status).toBe(403);
    expect((r.body as { code: string }).code).toBe('ACCOUNT_LOCKED');
  });
  it('phản hồi không chứa passwordHash', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'an@homnayangi.test', password: 'User@123' });
    expect(JSON.stringify(r.body)).not.toContain('passwordHash');
  });
  it('người dùng thường không gọi được API quản trị', async () => {
    const t = await login('an@homnayangi.test');
    expect((await call('GET', '/api/admin/dishes', undefined, t)).status).toBe(403);
    expect((await call('GET', '/api/admin/dishes')).status).toBe(401);
  });
  it('admin thường không xem được nhật ký quản trị (chỉ super_admin)', async () => {
    const t = await login('admin@homnayangi.test', 'Admin@123');
    expect((await call('GET', '/api/admin/audit-logs', undefined, t)).status).toBe(403);
    const s = await login('super@homnayangi.test', 'Super@123');
    expect((await call('GET', '/api/admin/audit-logs', undefined, s)).status).toBe(200);
  });
  it('đăng xuất thu hồi phiên tại máy chủ', async () => {
    const t = await login('an@homnayangi.test');
    await call('POST', '/api/auth/logout', undefined, t);
    expect((await call('GET', '/api/auth/me', undefined, t)).status).toBe(401);
  });
  it('khóa tài khoản thì phiên đang hoạt động bị thu hồi', async () => {
    const userToken = await login('binh@homnayangi.test');
    const admin = await login('admin@homnayangi.test', 'Admin@123');
    const r = await call('PATCH', '/api/admin/users/user-binh/status', { status: 'locked', reason: 'Spam' }, admin);
    expect(r.status).toBe(200);
    expect((await call('GET', '/api/cart', undefined, userToken)).status).toBe(401);
    expect(db.admin_audit_logs.some((l) => l.action === 'lock_user')).toBe(true);
  });
  it('không thu hồi quyền của super_admin cuối cùng', async () => {
    const s = await login('super@homnayangi.test', 'Super@123');
    const r = await call('PATCH', '/api/admin/users/user-super/role', { role: 'admin', reason: 'test' }, s);
    expect((r.body as { code: string }).code).toBe('LAST_SUPER_ADMIN');
  });
  it('đặt lại mật khẩu: liên kết chỉ dùng một lần', async () => {
    const r = await call('POST', '/api/auth/forgot-password', { email: 'an@homnayangi.test' });
    const token = new URL((r.body as { devResetLink: string }).devResetLink, 'http://x').searchParams.get('token');
    expect((await call('POST', '/api/auth/reset-password', { token, password: 'Moi12345' })).status).toBe(200);
    expect((await call('POST', '/api/auth/reset-password', { token, password: 'Khac12345' })).status).toBe(400);
    expect((await call('POST', '/api/auth/login', { email: 'an@homnayangi.test', password: 'Moi12345' })).status).toBe(200);
  });
});

describe('Món ăn công khai', () => {
  it('món ẩn và món nháp không truy cập được', async () => {
    expect((await call('GET', '/api/dishes/lau-thai')).status).toBe(404);
    expect((await call('GET', '/api/dishes/bun-rieu-cua')).status).toBe(404);
    const list = (await call('GET', '/api/dishes?pageSize=50')).body as { items: { slug: string }[] };
    expect(list.items.map((d) => d.slug)).not.toContain('lau-thai');
  });
  it('phân trang không trả toàn bộ kho món', async () => {
    const r = (await call('GET', '/api/dishes?page=1&pageSize=5')).body as { items: unknown[]; hasMore: boolean };
    expect(r.items).toHaveLength(5);
    expect(r.hasMore).toBe(true);
  });
  it('gợi ý cho người dùng có hồ sơ tránh tôm không trả món chứa tôm', async () => {
    const t = await login('an@homnayangi.test');
    const r = (await call('POST', '/api/recommendations', { mode: 'meal', mealSlot: 'bua-toi', limit: 48 }, t)).body as { items: { dish: { slug: string } }[] };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.map((i) => i.dish.slug)).not.toContain('tom-rim');
  });
  it('đổi món khác không trả lại món vừa bỏ qua', async () => {
    const r = (await call('POST', '/api/recommendations', { mode: 'meal', mealSlot: 'bua-trua', limit: 2 })).body as { eventId: string; items: { dish: { _id: string } }[] };
    const skipped = r.items[0].dish._id;
    const rep = (await call('POST', `/api/recommendations/${r.eventId}/replace`, { dishId: skipped })).body as { item: { dish: { _id: string } } };
    expect(rep.item.dish._id).not.toBe(skipped);
    expect(r.items.map((i) => i.dish._id)).not.toContain(rep.item.dish._id);
  });
});

describe('Giỏ hàng & đơn hàng', () => {
  it('phát hiện giá thay đổi, buộc xác nhận lại rồi mới tạo đơn; chống tạo đơn lặp', async () => {
    const t = await login('an@homnayangi.test');
    const info = { receiveInfo: { receiverName: 'An', phone: '0901234567', method: 'pickup' }, paymentMethod: 'cod', idempotencyKey: 'k1' };
    const first = await call('POST', '/api/orders', info, t);
    expect((first.body as { code: string }).code).toBe('CART_CHANGED');
    await call('POST', '/api/cart/remove-unavailable', undefined, t);
    await call('POST', '/api/cart/confirm-prices', undefined, t);
    const ok = await call('POST', '/api/orders', info, t);
    expect(ok.status).toBe(200);
    const order = ok.body as { _id: string; total: number; items: { unitPrice: number }[] };
    expect(order.items[0].unitPrice).toBe(45000);
    const again = await call('POST', '/api/orders', info, t);
    expect((again.body as { _id: string })._id).toBe(order._id);
    expect(db.orders.filter((o) => o.idempotencyKey === 'k1')).toHaveLength(1);
  });
  it('không dùng giá trình duyệt gửi lên', async () => {
    const t = await login('binh@homnayangi.test');
    await call('POST', '/api/cart/items', { dishId: 'dish-pho-bo', quantity: 2, price: 1 }, t);
    const r = await call('POST', '/api/orders', { receiveInfo: { receiverName: 'B', phone: '0912345678', method: 'pickup' }, paymentMethod: 'cod', idempotencyKey: 'x', total: 1 }, t);
    expect((r.body as { total: number }).total).toBe(110000);
  });
  it('không thêm được món hết hàng hoặc món không bán', async () => {
    const t = await login('binh@homnayangi.test');
    expect(((await call('POST', '/api/cart/items', { dishId: 'dish-banh-xeo', quantity: 1 }, t)).body as { code: string }).code).toBe('DISH_NOT_ORDERABLE');
    expect(((await call('POST', '/api/cart/items', { dishId: 'dish-rau-muong-xao-toi', quantity: 1 }, t)).body as { code: string }).code).toBe('DISH_NOT_ORDERABLE');
  });
  it('thiếu thông tin nhận món thì không tạo đơn', async () => {
    const t = await login('binh@homnayangi.test');
    await call('POST', '/api/cart/items', { dishId: 'dish-pho-bo', quantity: 1 }, t);
    const r = await call('POST', '/api/orders', { receiveInfo: { receiverName: '', phone: '12', method: 'delivery' }, paymentMethod: 'cod', idempotencyKey: 'y' }, t);
    expect(r.status).toBe(422);
    expect(Object.keys((r.body as { fieldErrors: object }).fieldErrors)).toEqual(expect.arrayContaining(['receiveInfo.receiverName', 'receiveInfo.phone', 'receiveInfo.address']));
  });
  it('không xem được đơn của tài khoản khác', async () => {
    const t = await login('binh@homnayangi.test');
    expect((await call('GET', '/api/orders/order-1', undefined, t)).status).toBe(404);
  });
  it('đơn cũ giữ giá đã chốt khi giá hiện tại thay đổi', async () => {
    const t = await login('an@homnayangi.test');
    const o = (await call('GET', '/api/orders/order-1', undefined, t)).body as { items: { unitPrice: number }[] };
    expect(o.items[0].unitPrice).toBe(40000);
  });
  it('hủy trực tiếp đơn pending; đơn đang chuẩn bị không hủy được', async () => {
    const t = await login('an@homnayangi.test');
    expect(((await call('POST', '/api/orders/order-3/cancel', { reason: 'Đổi ý' }, t)).body as { result: string }).result).toBe('cancelled');
    expect((await call('POST', '/api/orders/order-2/cancel', { reason: 'Đổi ý' }, t)).status).toBe(409);
  });
  it('quản trị viên không thể bỏ bước trạng thái; gửi lặp không tạo sự kiện trùng', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    const id = db.orders.find((o) => o.code === 'HNAG-103')!._id;
    expect((await call('PATCH', `/api/admin/orders/${id}/status`, { toStatus: 'completed', expectedStatus: 'pending' }, a)).status).toBe(409);
    expect((await call('PATCH', `/api/admin/orders/${id}/status`, { toStatus: 'confirmed', expectedStatus: 'pending' }, a)).status).toBe(200);
    const before = db.order_events.filter((e) => e.orderId === id).length;
    await call('PATCH', `/api/admin/orders/${id}/status`, { toStatus: 'confirmed', expectedStatus: 'pending' }, a);
    expect(db.order_events.filter((e) => e.orderId === id).length).toBe(before);
  });
  it('từ chối đơn bắt buộc có lý do', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    expect((await call('PATCH', '/api/admin/orders/order-3/status', { toStatus: 'rejected', expectedStatus: 'pending' }, a)).status).toBe(422);
  });
});

describe('Quản trị nội dung', () => {
  it('không xuất bản món thiếu bước nấu', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    const r = await call('POST', '/api/admin/dishes/dish-bun-rieu-cua/publish', undefined, a);
    expect(r.status).toBe(422);
    expect(db.dishes.find((d) => d._id === 'dish-bun-rieu-cua')!.status).toBe('draft');
  });
  it('không xóa cứng nguyên liệu đang được dùng', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    expect((await call('DELETE', '/api/admin/ingredients/ing-trung-ga', undefined, a)).status).toBe(409);
  });
  it('món có đơn hàng thì không xóa được', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    expect((await call('DELETE', '/api/admin/dishes/dish-pho-bo', undefined, a)).status).toBe(409);
  });
  it('lỗi giữa chừng không ghi nhận thay đổi một phần', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    const before = db.dishes.length;
    await call('POST', '/api/admin/dishes', { name: 'Món lỗi', baseServings: 0 }, a);
    expect(db.dishes.length).toBe(before);
  });
  it('thống kê không chia cho 0 khi chưa có dữ liệu', async () => {
    const a = await login('admin@homnayangi.test', 'Admin@123');
    const r = (await call('GET', '/api/admin/stats/recommendation?from=2020-01-01&to=2020-01-02', undefined, a)).body as { openRate: number | null };
    expect(r.openRate).toBeNull();
  });
});
