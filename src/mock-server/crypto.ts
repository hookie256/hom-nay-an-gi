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

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Trả về null nếu không nhận dạng được định dạng băm */
  verify(password: string, stored: string): Promise<boolean | null>;
}

/** Mặc định: SHA-256 có salt (chỉ cho chế độ chạy trong trình duyệt). */
const sha256Hasher: PasswordHasher = {
  async hash(password) {
    return sha256Hash(password, newId());
  },
  async verify(password, stored) {
    if (!stored.startsWith('sha256$')) return null;
    const [, salt] = stored.split('$');
    return (await sha256Hash(password, salt)) === stored;
  },
};

async function sha256Hash(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256$${salt}$${hex}`;
}

let hasher: PasswordHasher = sha256Hasher;

/** Máy chủ Node đăng ký thuật toán băm mạnh hơn (scrypt). */
export function setPasswordHasher(h: PasswordHasher): void {
  hasher = h;
}

export function hashPassword(password: string): Promise<string> {
  return hasher.hash(password);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const r = await hasher.verify(password, stored);
  if (r !== null) return r;
  // Dữ liệu cũ băm bằng SHA-256 vẫn đăng nhập được
  return (await sha256Hasher.verify(password, stored)) ?? false;
}
