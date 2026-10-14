/**
 * Server API "Hôm Nay Ăn Gì?" – Node.js + MongoDB.
 * Dùng chung toàn bộ handler nghiệp vụ với mock server (src/mock-server/handlers) để đảm bảo
 * hành vi giống hệt; khác biệt là dữ liệu đọc/ghi từ MongoDB trong transaction.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { executeRequest } from '../src/mock-server/execute';
import { setPasswordHasher } from '../src/mock-server/crypto';
import { serverConfig } from '../src/mock-server/config';
import { config } from './config';
import { ensureIndexes, loadState, persistDiff } from './mongoStore';
import { scryptHasher } from './passwords';

setPasswordHasher(scryptHasher);
serverConfig.exposeResetLink = config.exposeResetLink;

/** Mã phiên chỉ lưu dạng băm trong collection sessions. */
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const MAX_BODY = 1_000_000;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) reject(Object.assign(new Error('too large'), { status: 413 }));
      else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('bad json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(json);
}

export async function startServer(port = config.port) {
  const client = await MongoClient.connect(config.mongoUri);
  const db = client.db(config.dbName);
  await ensureIndexes(db);
  // Xử lý tuần tự trong một tiến trình: tránh hai yêu cầu cùng ghi đè trạng thái
  let queue: Promise<unknown> = Promise.resolve();

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (!url.startsWith('/api/')) return send(res, 404, { code: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy.' });
    if (url === '/api/health') return send(res, 200, { ok: true });
    let body: unknown;
    try {
      body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await readBody(req);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 400;
      return send(res, status, { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST', message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    const auth = req.headers.authorization;
    const rawToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    const method = req.method ?? 'GET';

    const run = async () => {
      const session = client.startSession();
      try {
        let result: { status: number; body: unknown } = { status: 500, body: null };
        await session.withTransaction(async () => {
          const state = await loadState(db, session);
          const before = structuredClone(state);
          const r = await executeRequest(state, method, url, body, rawToken ? hashToken(rawToken) : null, new Date());
          if (r.ok && method === 'POST' && url.startsWith('/api/auth/login')) {
            // Lưu mã phiên dạng băm; trả mã gốc cho trình duyệt
            const token = (r.body as { token: string }).token;
            const s = state.sessions.find((x) => x.token === token);
            if (s) s.token = hashToken(token);
          }
          if (r.ok) await persistDiff(db, before, state, session);
          result = r;
        });
        return result;
      } finally {
        await session.endSession();
      }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    try {
      const r = await p;
      send(res, r.status, r.body);
    } catch (e) {
      console.error('[server] lỗi', e);
      send(res, 503, { code: 'DATABASE_ERROR', message: 'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.' });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    port,
    close: async () => {
      await new Promise((r) => server.close(r));
      await client.close();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(({ port }) => console.log(`API đang chạy tại http://127.0.0.1:${port}/api (MongoDB: ${config.dbName})`))
    .catch((e) => {
      console.error('Không khởi động được server:', e.message);
      process.exit(1);
    });
}
