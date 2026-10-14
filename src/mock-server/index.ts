/**
 * MÁY CHỦ GIẢ (mock server) chạy ngay trong trình duyệt.
 * Mô phỏng hợp đồng API ở mục 5.13 để giao diện hoạt động khi chưa có backend FastAPI + MongoDB.
 * Mọi kiểm tra quyền, giá, trạng thái ở đây chỉ mô phỏng logic – KHÔNG có giá trị bảo mật thật.
 */
import { ApiError } from './errors';
import { loadDb, saveDb } from './db';
import { match } from './router';
import './handlers/account';
import './handlers/catalog';
import './handlers/interactions';
import './handlers/commerce';
import './handlers/adminContent';
import './handlers/adminOps';

export interface MockResponse {
  status: number;
  body: unknown;
}

let queue: Promise<unknown> = Promise.resolve();

/** Xử lý tuần tự từng yêu cầu để mô phỏng cập nhật nguyên tử (một kết quả hợp lệ khi gửi đồng thời). */
export function handleRequest(method: string, url: string, body: unknown, token: string | null, now = new Date()): Promise<MockResponse> {
  const run = async (): Promise<MockResponse> => {
    const db = await loadDb();
    const u = new URL(url, 'http://mock.local');
    const path = u.pathname.replace(/^\/api/, '');
    const found = match(method, path);
    if (!found) return { status: 404, body: { code: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy chức năng yêu cầu.' } };
    // Sao chép trạng thái để lỗi giữa chừng không ghi nhận thành công một phần (NFR14)
    const snapshot = structuredClone(db);
    try {
      const data = await found.handler({ db, params: found.params, query: u.searchParams, body: body ?? {}, token, now });
      saveDb();
      return { status: 200, body: data };
    } catch (e) {
      Object.assign(db, snapshot);
      if (e instanceof ApiError) return { status: e.status, body: e.toBody() };
      // Không lộ chi tiết nội bộ ra giao diện (NFR23) – chỉ ghi log
      console.error('[mock-server] lỗi nội bộ', e);
      return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' } };
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export { resetDb, exportDb, importDb } from './db';
