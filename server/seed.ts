/**
 * Tạo dữ liệu mẫu trong MongoDB.
 *   npm run db:seed          – chỉ tạo khi CSDL đang trống
 *   npm run db:seed -- --reset – xóa toàn bộ và tạo lại
 */
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createSeedState, type DbState } from '../src/mock-server/db';
import { setPasswordHasher } from '../src/mock-server/crypto';
import { config } from './config';
import { ARRAY_COLLECTIONS, ensureIndexes, writeFullState } from './mongoStore';
import { scryptHasher } from './passwords';

/** Mã dữ liệu mẫu dễ đọc (vd. "dish-pho-bo") → ObjectId cố định (24 hex), thay ở cả giá trị lẫn khóa. */
function remapSeedIds(state: DbState): DbState {
  const map = new Map<string, string>();
  for (const col of ARRAY_COLLECTIONS) {
    for (const d of state[col] as unknown as { _id?: string }[]) {
      if (d._id && !/^[0-9a-f]{24}$/.test(d._id)) map.set(d._id, createHash('sha1').update(`hnag:${d._id}`).digest('hex').slice(0, 24));
    }
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return map.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, walk(x)]));
    return v;
  };
  return walk(state) as DbState;
}

export async function seed(reset: boolean): Promise<string> {
  const client = await MongoClient.connect(config.mongoUri);
  try {
    const db = client.db(config.dbName);
    const existing = await db.collection('users').countDocuments();
    if (existing > 0 && !reset) return `CSDL "${config.dbName}" đã có dữ liệu (${existing} tài khoản). Dùng --reset để tạo lại.`;
    if (reset) await db.dropDatabase();
    setPasswordHasher(scryptHasher);
    const state = remapSeedIds(await createSeedState(new Date()));
    await writeFullState(db, state);
    await ensureIndexes(db);
    const counts = await Promise.all(ARRAY_COLLECTIONS.map(async (c) => `${c}: ${await db.collection(c).countDocuments()}`));
    return `Đã tạo dữ liệu mẫu trong "${config.dbName}":\n  ${counts.join('\n  ')}`;
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed(process.argv.includes('--reset'))
    .then((msg) => console.log(msg))
    .catch((e) => {
      console.error('Không tạo được dữ liệu mẫu:', e.message);
      process.exit(1);
    });
}
