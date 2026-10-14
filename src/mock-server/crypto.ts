/**
 * Tiện ích sinh mã và băm mật khẩu cho MÁY CHỦ GIẢ.
 * Lưu ý: chạy trong trình duyệt nên KHÔNG có giá trị bảo mật thật; backend thật phải dùng
 * thuật toán băm chuyên dụng (bcrypt/argon2) ở máy chủ (NFR05).
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt = newId()): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256$${salt}$${hex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt] = stored.split('$');
  if (!salt) return false;
  return (await hashPassword(password, salt)) === stored;
}
