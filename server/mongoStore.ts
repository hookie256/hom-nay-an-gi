/**
 * Ánh xạ giữa DbState (dùng bởi các handler nghiệp vụ) và MongoDB.
 *  - Chuỗi 24 ký tự hex  ⇄ ObjectId  (_id và các trường tham chiếu – Bảng 5.2–5.17)
 *  - Chuỗi ISO 8601 đầy đủ ⇄ Date
 *  - Mỗi yêu cầu: đọc trạng thái trong transaction, chạy handler, chỉ ghi document thay đổi.
 */
import { ObjectId, type ClientSession, type Db, type Document } from 'mongodb';
import type { DbState } from '../src/mock-server/db';

export const ARRAY_COLLECTIONS = [
  'users', 'user_profiles', 'categories', 'units', 'ingredients', 'dishes', 'selling_menus', 'favorites', 'reviews',
  'review_reports', 'carts', 'orders', 'order_events', 'recommendation_events', 'activity_events', 'admin_audit_logs',
  'sessions', 'password_reset_tokens', 'search_events', 'ingredient_selections', 'dish_view_stats',
] as const;
type ArrayCollection = (typeof ARRAY_COLLECTIONS)[number];

const SETTINGS_COLLECTION = 'settings';
const ORDER_SETTINGS_ID = 'order_settings';
const SCHEMA_VERSION = 2;

const HEX24 = /^[0-9a-f]{24}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** dish_view_stats không có _id trong model → dùng khóa ghép */
const keyOf = (col: ArrayCollection, doc: Record<string, unknown>): string =>
  col === 'dish_view_stats' ? `${doc.dishId}|${doc.date}` : String(doc._id);

export function toBson(value: unknown): unknown {
  if (typeof value === 'string') {
    if (HEX24.test(value)) return new ObjectId(value);
    if (ISO_DATETIME.test(value)) return new Date(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(toBson);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = toBson(v);
    return out;
  }
  return value;
}

export function fromBson(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(fromBson);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = fromBson(v);
    return out;
  }
  return value;
}

function toDoc(col: ArrayCollection, item: unknown): Document {
  const doc = toBson(item) as Document;
  if (col === 'dish_view_stats') doc._id = keyOf(col, item as Record<string, unknown>);
  return doc;
}

export async function loadState(db: Db, session?: ClientSession): Promise<DbState> {
  const state = { schemaVersion: SCHEMA_VERSION } as DbState;
  await Promise.all(
    ARRAY_COLLECTIONS.map(async (col) => {
      const docs = await db.collection(col).find({}, { session }).toArray();
      (state as unknown as Record<string, unknown>)[col] = docs.map((d) => {
        const o = fromBson(d) as Record<string, unknown>;
        if (col === 'dish_view_stats') delete o._id;
        return o;
      });
    }),
  );
  const settings = await db.collection(SETTINGS_COLLECTION).findOne({ _id: ORDER_SETTINGS_ID as unknown as ObjectId }, { session });
  if (!settings) throw new Error('Chưa có dữ liệu. Hãy chạy: npm run db:seed');
  const { _id: _ignore, ...rest } = fromBson(settings) as Record<string, unknown>;
  void _ignore;
  state.order_settings = rest as unknown as DbState['order_settings'];
  return state;
}

/** Ghi phần khác biệt giữa trạng thái trước và sau khi chạy handler. Trả về số thao tác ghi. */
export async function persistDiff(db: Db, before: DbState, after: DbState, session?: ClientSession): Promise<number> {
  let writes = 0;
  for (const col of ARRAY_COLLECTIONS) {
    const b = new Map((before[col] as unknown as Record<string, unknown>[]).map((d) => [keyOf(col, d), d]));
    const a = new Map((after[col] as unknown as Record<string, unknown>[]).map((d) => [keyOf(col, d), d]));
    const ops: Document[] = [];
    for (const [k, doc] of a) {
      const prev = b.get(k);
      if (!prev) ops.push({ insertOne: { document: toDoc(col, doc) } });
      else if (JSON.stringify(prev) !== JSON.stringify(doc)) {
        const d = toDoc(col, doc);
        ops.push({ replaceOne: { filter: { _id: d._id }, replacement: d } });
      }
    }
    for (const [k, doc] of b) if (!a.has(k)) ops.push({ deleteOne: { filter: { _id: toDoc(col, doc)._id } } });
    if (ops.length) {
      await db.collection(col).bulkWrite(ops as never[], { session, ordered: true });
      writes += ops.length;
    }
  }
  if (JSON.stringify(before.order_settings) !== JSON.stringify(after.order_settings)) {
    await db.collection(SETTINGS_COLLECTION).replaceOne({ _id: ORDER_SETTINGS_ID as unknown as ObjectId }, { ...(toBson(after.order_settings) as Document) }, { session, upsert: true });
    writes++;
  }
  return writes;
}

/** Ghi toàn bộ trạng thái (dùng khi tạo dữ liệu mẫu). */
export async function writeFullState(db: Db, state: DbState): Promise<void> {
  for (const col of ARRAY_COLLECTIONS) {
    const docs = (state[col] as unknown[]).map((d) => toDoc(col, d));
    if (docs.length) await db.collection(col).insertMany(docs);
  }
  await db.collection(SETTINGS_COLLECTION).replaceOne({ _id: ORDER_SETTINGS_ID as unknown as ObjectId }, toBson(state.order_settings) as Document, { upsert: true });
}

/** Chỉ mục theo mục 5.9 của báo cáo. */
export async function ensureIndexes(db: Db): Promise<void> {
  const idx = async (col: string, spec: Document, opts: Document = {}) => db.collection(col).createIndex(spec, opts);
  // Chỉ mục duy nhất
  await idx('users', { email: 1 }, { unique: true });
  await idx('user_profiles', { userId: 1 }, { unique: true });
  await idx('favorites', { userId: 1, dishId: 1 }, { unique: true });
  await idx('reviews', { userId: 1, dishId: 1 }, { unique: true });
  await idx('categories', { type: 1, slug: 1 }, { unique: true });
  await idx('dishes', { slug: 1 }, { unique: true });
  await idx('ingredients', { canonicalName: 1 }, { unique: true });
  await idx('units', { name: 1 }, { unique: true });
  await idx('units', { symbol: 1 }, { unique: true });
  await idx('carts', { userId: 1 }, { unique: true });
  await idx('selling_menus', { dishId: 1 }, { unique: true });
  await idx('sessions', { token: 1 }, { unique: true });
  await idx('password_reset_tokens', { token: 1 }, { unique: true });
  await idx('orders', { userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
  // Tìm kiếm và lọc món
  await idx('dishes', { status: 1, mealSlotIds: 1 });
  await idx('dishes', { status: 1, categoryIds: 1 });
  await idx('dishes', { status: 1, cuisineIds: 1 });
  await idx('dishes', { status: 1, publishedAt: -1 });
  await idx('ingredients', { aliases: 1 });
  // Lịch sử và đơn hàng
  await idx('orders', { userId: 1, createdAt: -1, _id: -1 });
  await idx('orders', { orderStatus: 1, createdAt: -1, _id: -1 });
  await idx('order_events', { orderId: 1, createdAt: 1 });
  await idx('activity_events', { userId: 1, createdAt: -1 });
  await idx('recommendation_events', { userId: 1, createdAt: -1 });
  await idx('admin_audit_logs', { actorId: 1, action: 1, createdAt: -1 });
  await idx('admin_audit_logs', { createdAt: -1 });
  await idx('review_reports', { reviewId: 1, status: 1 });
  await idx('search_events', { createdAt: -1 });
}
