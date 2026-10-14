/**
 * Chạy một yêu cầu API trên một trạng thái CSDL (DbState) – dùng chung cho
 * mock server trong trình duyệt (localStorage) và server Node (MongoDB).
 */
import { ApiError } from './errors';
import type { DbState } from './db';
import { match } from './router';
import './handlers/account';
import './handlers/catalog';
import './handlers/interactions';
import './handlers/commerce';
import './handlers/adminContent';
import './handlers/adminOps';

export interface ApiResponse {
  status: number;
  body: unknown;
}

/**
 * Thực thi handler. Nếu handler lỗi, mọi thay đổi trên `db` được hoàn tác (NFR14).
 * Trả về `changed = false` khi không cần ghi lại.
 */
export async function executeRequest(db: DbState, method: string, url: string, body: unknown, token: string | null, now: Date): Promise<ApiResponse & { ok: boolean }> {
  const u = new URL(url, 'http://local');
  const path = u.pathname.replace(/^\/api/, '');
  const found = match(method, path);
  if (!found) return { ok: false, status: 404, body: { code: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy chức năng yêu cầu.' } };
  const snapshot = structuredClone(db);
  try {
    const data = await found.handler({ db, params: found.params, query: u.searchParams, body: body ?? {}, token, now });
    return { ok: true, status: 200, body: data };
  } catch (e) {
    Object.assign(db, snapshot);
    if (e instanceof ApiError) return { ok: false, status: e.status, body: e.toBody() };
    // Không lộ chi tiết nội bộ ra giao diện (NFR23) – chỉ ghi log
    console.error('[api] lỗi nội bộ', e);
    return { ok: false, status: 500, body: { code: 'INTERNAL_ERROR', message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' } };
  }
}
