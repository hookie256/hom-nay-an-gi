import type { UserProfile } from '@/types/models';
import { DIETS, TASTES } from '@/domain/constants';
import { EMAIL_RE, normalizeEmail } from '@/domain/text';
import { route } from '../router';
import { Errors } from '../errors';
import { hashPassword, newId, newToken, verifyPassword } from '../crypto';
import { requireUser, SESSION_TTL_MS, str, toPublicUser } from '../helpers';

const RESET_TTL_MS = 30 * 60 * 1000;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mật khẩu cần có cả chữ và số.';
  return null;
}

// ---------- UC01 Đăng ký ----------
route('POST', '/auth/register', async (ctx) => {
  const name = str(ctx.body?.name).trim();
  const email = normalizeEmail(str(ctx.body?.email));
  const password = str(ctx.body?.password);
  const fe: Record<string, string> = {};
  if (!name) fe.name = 'Vui lòng nhập tên.';
  else if (name.length > 60) fe.name = 'Tên tối đa 60 ký tự.';
  if (!email) fe.email = 'Vui lòng nhập email.';
  else if (!EMAIL_RE.test(email)) fe.email = 'Email chưa đúng định dạng.';
  const pwErr = validatePassword(password);
  if (pwErr) fe.password = pwErr;
  if (Object.keys(fe).length) throw Errors.validation(fe);
  if (ctx.db.users.some((u) => u.email === email)) throw Errors.validation({ email: 'Email này đã được đăng ký.' }, 'Email đã được sử dụng.');

  const now = ctx.now.toISOString();
  const user = { _id: newId(), email, passwordHash: await hashPassword(password), role: 'user' as const, status: 'active' as const, createdAt: now, updatedAt: now };
  ctx.db.users.push(user);
  ctx.db.user_profiles.push({
    _id: newId(), userId: user._id, displayName: name, tastes: [], favoriteCategoryIds: [], cuisineIds: [], dietCodes: [],
    avoidedIngredientIds: [], saveHistory: false, createdAt: now, updatedAt: now,
  });
  return { user: toPublicUser(ctx.db, user) };
});

// ---------- UC02 Đăng nhập ----------
route('POST', '/auth/login', async (ctx) => {
  const email = normalizeEmail(str(ctx.body?.email));
  const password = str(ctx.body?.password);
  const fe: Record<string, string> = {};
  if (!email) fe.email = 'Vui lòng nhập email.';
  if (!password) fe.password = 'Vui lòng nhập mật khẩu.';
  if (Object.keys(fe).length) throw Errors.validation(fe);
  const user = ctx.db.users.find((u) => u.email === email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw Errors.badRequest('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }
  if (user.status !== 'active') throw Errors.accountLocked();
  const token = newToken();
  ctx.db.sessions.push({
    _id: newId(), token, userId: user._id, createdAt: ctx.now.toISOString(),
    expiresAt: new Date(ctx.now.getTime() + SESSION_TTL_MS).toISOString(),
  });
  return { token, user: toPublicUser(ctx.db, user) };
});

// ---------- UC03 Đăng xuất (thu hồi phiên tại máy chủ) ----------
route('POST', '/auth/logout', (ctx) => {
  const s = ctx.db.sessions.find((x) => x.token === ctx.token);
  if (s && !s.revokedAt) s.revokedAt = ctx.now.toISOString();
  return { ok: true };
});

route('GET', '/auth/me', (ctx) => {
  const user = requireUser(ctx);
  return { user: toPublicUser(ctx.db, user), expiresAt: ctx.session!.expiresAt };
});

// ---------- UC05 Đặt lại mật khẩu ----------
route('POST', '/auth/forgot-password', (ctx) => {
  const email = normalizeEmail(str(ctx.body?.email));
  if (!EMAIL_RE.test(email)) throw Errors.validation({ email: 'Email chưa đúng định dạng.' });
  const user = ctx.db.users.find((u) => u.email === email);
  // Không tiết lộ email có tồn tại hay không.
  const response: { ok: true; message: string; devResetLink?: string } = {
    ok: true,
    message: 'Nếu email đã được đăng ký, liên kết đặt lại mật khẩu sẽ được gửi tới hộp thư trong vài phút.',
  };
  if (user) {
    const token = newToken();
    ctx.db.password_reset_tokens.push({ _id: newId(), token, userId: user._id, expiresAt: new Date(ctx.now.getTime() + RESET_TTL_MS).toISOString() });
    // CHỈ Ở CHẾ ĐỘ MOCK: chưa có dịch vụ gửi email nên trả liên kết để chạy thử.
    response.devResetLink = `/dat-lai-mat-khau?token=${token}`;
  }
  return response;
});

route('POST', '/auth/reset-password', async (ctx) => {
  const token = str(ctx.body?.token);
  const password = str(ctx.body?.password);
  const rec = ctx.db.password_reset_tokens.find((t) => t.token === token);
  if (!rec || rec.usedAt || Date.parse(rec.expiresAt) <= ctx.now.getTime()) {
    throw Errors.badRequest('RESET_TOKEN_INVALID', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  }
  const pwErr = validatePassword(password);
  if (pwErr) throw Errors.validation({ password: pwErr });
  const user = ctx.db.users.find((u) => u._id === rec.userId);
  if (!user) throw Errors.notFound('Tài khoản');
  user.passwordHash = await hashPassword(password);
  user.updatedAt = ctx.now.toISOString();
  rec.usedAt = ctx.now.toISOString();
  // Thu hồi mọi phiên cũ sau khi đổi mật khẩu
  ctx.db.sessions.filter((s) => s.userId === user._id && !s.revokedAt).forEach((s) => (s.revokedAt = ctx.now.toISOString()));
  return { ok: true };
});

// ---------- UC07–UC10 Hồ sơ & sở thích ----------
function getProfile(ctx: Parameters<typeof requireUser>[0]): UserProfile {
  const user = requireUser(ctx);
  let p = ctx.db.user_profiles.find((x) => x.userId === user._id);
  if (!p) {
    const now = ctx.now.toISOString();
    p = { _id: newId(), userId: user._id, tastes: [], favoriteCategoryIds: [], cuisineIds: [], dietCodes: [], avoidedIngredientIds: [], saveHistory: false, createdAt: now, updatedAt: now };
    ctx.db.user_profiles.push(p);
  }
  return p;
}

route('GET', '/profile', (ctx) => {
  const p = getProfile(ctx);
  return { profile: p, email: ctx.user!.email };
});

route('PATCH', '/profile', (ctx) => {
  const p = getProfile(ctx);
  const b = ctx.body ?? {};
  const fe: Record<string, string> = {};
  const next: Partial<UserProfile> = {};
  const activeCat = (type: string, id: string) => ctx.db.categories.some((c) => c._id === id && c.type === type && c.status === 'active');
  const ids = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string'))) : null);

  if ('displayName' in b) {
    const name = str(b.displayName).trim();
    if (!name) fe.displayName = 'Tên hiển thị không được để trống.';
    else if (name.length > 60) fe.displayName = 'Tên hiển thị tối đa 60 ký tự.';
    else next.displayName = name;
  }
  if ('tastes' in b) {
    const v = ids(b.tastes);
    if (!v || v.some((t) => !TASTES.some((x) => x.code === t))) fe.tastes = 'Khẩu vị không hợp lệ.';
    else next.tastes = v;
  }
  if ('favoriteCategoryIds' in b) {
    const v = ids(b.favoriteCategoryIds);
    // UC08: danh mục đã ẩn không thể chọn mới (cho phép giữ lại mục đã chọn trước đó)
    if (!v || v.some((id) => !activeCat('dishType', id) && !p.favoriteCategoryIds.includes(id))) fe.favoriteCategoryIds = 'Có loại món không hợp lệ hoặc đã bị ẩn.';
    else next.favoriteCategoryIds = v;
  }
  if ('cuisineIds' in b) {
    const v = ids(b.cuisineIds);
    if (!v || v.some((id) => !activeCat('cuisine', id) && !p.cuisineIds.includes(id))) fe.cuisineIds = 'Có loại ẩm thực không hợp lệ hoặc đã bị ẩn.';
    else next.cuisineIds = v;
  }
  if ('dietCodes' in b) {
    const v = ids(b.dietCodes);
    if (!v || v.some((d) => !DIETS.some((x) => x.code === d))) fe.dietCodes = 'Chế độ ăn không hợp lệ.';
    else next.dietCodes = v;
  }
  if ('avoidedIngredientIds' in b) {
    const v = ids(b.avoidedIngredientIds);
    if (!v || v.some((id) => !ctx.db.ingredients.some((i) => i._id === id))) fe.avoidedIngredientIds = 'Có nguyên liệu không có trong danh mục chuẩn.';
    else next.avoidedIngredientIds = v;
  }
  if ('preferredCookMinutes' in b) {
    const v = b.preferredCookMinutes;
    if (v === null || v === '') next.preferredCookMinutes = undefined;
    else if (!Number.isInteger(v) || v <= 0 || v > 600) fe.preferredCookMinutes = 'Thời gian phải là số nguyên dương, tối đa 600 phút.';
    else next.preferredCookMinutes = v;
  }
  if ('saveHistory' in b) {
    if (typeof b.saveHistory !== 'boolean') fe.saveHistory = 'Giá trị không hợp lệ.';
    else next.saveHistory = b.saveHistory;
  }
  if (Object.keys(fe).length) throw Errors.validation(fe);
  Object.assign(p, next, { updatedAt: ctx.now.toISOString() });
  return { profile: p };
});
