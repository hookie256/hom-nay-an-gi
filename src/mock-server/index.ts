/**
 * MÁY CHỦ GIẢ (mock server) chạy ngay trong trình duyệt – dùng khi VITE_API_MODE=mock.
 * Dữ liệu lưu trong localStorage. Mọi kiểm tra quyền chỉ mô phỏng logic, KHÔNG có giá trị bảo mật.
 * Chế độ mặc định là server Node + MongoDB (thư mục server/).
 */
import { loadDb, saveDb } from './db';
import { executeRequest, type ApiResponse } from './execute';

export type MockResponse = ApiResponse;

let queue: Promise<unknown> = Promise.resolve();

/** Xử lý tuần tự từng yêu cầu để mô phỏng cập nhật nguyên tử. */
export function handleRequest(method: string, url: string, body: unknown, token: string | null, now = new Date()): Promise<MockResponse> {
  const run = async (): Promise<MockResponse> => {
    const db = await loadDb();
    const res = await executeRequest(db, method, url, body, token, now);
    if (res.ok) saveDb();
    return { status: res.status, body: res.body };
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export { resetDb, exportDb, importDb } from './db';
