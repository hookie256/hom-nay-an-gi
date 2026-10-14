/**
 * Chuẩn hóa chuỗi tiếng Việt cho tìm kiếm: chữ thường, bỏ dấu, gộp khoảng trắng.
 * Cách xử lý thống nhất giữa lúc ghi và lúc tìm (mục 5.9).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gộp khoảng trắng thừa của từ khóa (UC19). */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^(0|\+84)\d{9,10}$/;
