import type { ApiErrorBody } from '@/types/api';

const MODE = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
const TOKEN_KEY = 'hnag-token';

export const isMockApi = MODE !== 'http';

/** Lỗi phía giao diện, giữ code/message/fieldErrors từ API (mục 5.13). */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

let token: string | null = readToken();
const unauthorizedListeners = new Set<(code: string) => void>();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* bỏ qua khi bị chặn lưu trữ */
  }
}

export const getToken = () => token;

/** Được gọi khi API trả về phiên hết hạn/bị khóa để AuthContext đăng xuất phía giao diện. */
export function onUnauthorized(fn: (code: string) => void): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

type Query = Record<string, string | number | boolean | undefined | null | (string | number)[]>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
    else params.set(k, String(v));
  });
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  let status: number;
  let data: unknown;
  try {
    if (isMockApi) {
      const { handleRequest } = await import('@/mock-server');
      // Độ trễ mô phỏng mạng để giao diện thể hiện trạng thái đang tải
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
      const res = await handleRequest(method, url, opts.body, token);
      status = res.status;
      data = res.body;
    } else {
      const res = await fetch(`${BASE_URL}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      status = res.status;
      data = res.status === 204 ? null : await res.json().catch(() => null);
    }
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }
  if (status >= 200 && status < 300) return data as T;
  const err = (data ?? {}) as Partial<ApiErrorBody>;
  const code = err.code ?? 'UNKNOWN_ERROR';
  if (status === 401 || code === 'ACCOUNT_LOCKED') unauthorizedListeners.forEach((fn) => fn(code));
  throw new ApiRequestError(status, code, err.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.', err.fieldErrors);
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
