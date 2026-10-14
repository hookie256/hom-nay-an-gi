/**
 * Kiểm thử tích hợp server + MongoDB (database riêng "hom_nay_an_gi_test").
 * Cần MongoDB đang chạy (npm run db:up); nếu không kết nối được thì bỏ qua.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

process.env.MONGODB_DB = 'hom_nay_an_gi_test';
process.env.EXPOSE_RESET_LINK = 'true';
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/?directConnection=true';

let available = true;
try {
  const c = await MongoClient.connect(URI, { serverSelectionTimeoutMS: 1500 });
  await c.close();
} catch {
  available = false;
}

describe.skipIf(!available)('Server API + MongoDB', () => {
  let base = '';
  let close: () => Promise<void>;
  let mongo: MongoClient;

  beforeAll(async () => {
    const { seed } = await import('./seed');
    await seed(true);
    const { startServer } = await import('./index');
    const s = await startServer(4100 + Math.floor(Math.random() * 500));
    base = `http://127.0.0.1:${s.port}/api`;
    close = s.close;
    mongo = await MongoClient.connect(URI);
  }, 60000);

  afterAll(async () => {
    await close?.();
    await mongo?.db('hom_nay_an_gi_test').dropDatabase();
    await mongo?.close();
  });

  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  const login = async (email: string, password = 'User@123') => (await call('POST', '/auth/login', { email, password })).body.token as string;
  const db = () => mongo.db('hom_nay_an_gi_test');

  it('lưu _id/khóa tham chiếu dạng ObjectId và ngày dạng Date', async () => {
    const dish = await db().collection('dishes').findOne({ slug: 'pho-bo' });
    expect(dish!._id).toBeInstanceOf(ObjectId);
    expect(dish!.mealSlotIds[0]).toBeInstanceOf(ObjectId);
    expect(dish!.createdAt).toBeInstanceOf(Date);
  });

  it('mật khẩu băm scrypt, phiên lưu dạng băm, phản hồi không chứa passwordHash', async () => {
    const r = await call('POST', '/auth/login', { email: 'an@homnayangi.test', password: 'User@123' });
    expect(JSON.stringify(r.body)).not.toContain('passwordHash');
    const user = await db().collection('users').findOne({ email: 'an@homnayangi.test' });
    expect(user!.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(await db().collection('sessions').findOne({ token: r.body.token })).toBeNull();
    expect((await call('GET', '/auth/me', undefined, r.body.token)).status).toBe(200);
  });

  it('phân quyền và chống truy cập chéo', async () => {
    const binh = await login('binh@homnayangi.test');
    expect((await call('GET', '/admin/dishes', undefined, binh)).status).toBe(403);
    const anOrder = await db().collection('orders').findOne({ code: 'HNAG-101' });
    expect((await call('GET', `/orders/${anOrder!._id.toHexString()}`, undefined, binh)).status).toBe(404);
  });

  it('đặt hàng: kiểm tra giá, ghi đơn + sự kiện + giỏ trong một transaction, chống tạo trùng', async () => {
    const t = await login('an@homnayangi.test');
    const req = { receiveInfo: { receiverName: 'An', phone: '0901234567', method: 'pickup' }, paymentMethod: 'cod', idempotencyKey: 'it-1' };
    expect((await call('POST', '/orders', req, t)).body.code).toBe('CART_CHANGED');
    await call('POST', '/cart/remove-unavailable', {}, t);
    await call('POST', '/cart/confirm-prices', {}, t);
    const [a, b] = await Promise.all([call('POST', '/orders', req, t), call('POST', '/orders', req, t)]);
    expect(a.status).toBe(200);
    expect(b.body._id).toBe(a.body._id);
    const id = new ObjectId(a.body._id as string);
    expect(await db().collection('orders').countDocuments({ idempotencyKey: 'it-1' })).toBe(1);
    expect(await db().collection('order_events').countDocuments({ orderId: id })).toBe(1);
    expect((await db().collection('carts').findOne({ userId: (await db().collection('users').findOne({ email: 'an@homnayangi.test' }))!._id }))!.items).toHaveLength(0);
  });

  it('lỗi nghiệp vụ không ghi gì vào CSDL', async () => {
    const admin = await login('admin@homnayangi.test', 'Admin@123');
    const before = await db().collection('dishes').countDocuments();
    const r = await call('POST', '/admin/dishes', { name: 'Món lỗi', baseServings: 0 }, admin);
    expect(r.status).toBe(422);
    expect(await db().collection('dishes').countDocuments()).toBe(before);
    expect(await db().collection('admin_audit_logs').countDocuments({ action: 'create_dish' })).toBe(0);
  });

  it('khóa tài khoản thu hồi phiên và ghi nhật ký quản trị', async () => {
    const binh = await login('binh@homnayangi.test');
    const admin = await login('admin@homnayangi.test', 'Admin@123');
    const u = await db().collection('users').findOne({ email: 'binh@homnayangi.test' });
    expect((await call('PATCH', `/admin/users/${u!._id.toHexString()}/status`, { status: 'locked', reason: 'test' }, admin)).status).toBe(200);
    expect((await call('GET', '/cart', undefined, binh)).status).toBe(401);
    const log = await db().collection('admin_audit_logs').findOne({ action: 'lock_user' });
    expect(log!.actorId).toBeInstanceOf(ObjectId);
  });
});
