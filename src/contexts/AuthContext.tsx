import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PublicUser, Role } from '@/types/models';
import { authService } from '@/services';
import { getToken, onUnauthorized, setToken } from '@/services/apiClient';

interface AuthApi {
  user: PublicUser | null;
  /** Đang kiểm tra phiên lúc khởi động */
  initializing: boolean;
  /** Lý do phiên kết thúc (hết hạn/bị khóa) để hiển thị cho người dùng */
  sessionNotice: string | null;
  clearNotice: () => void;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionNotice, setNotice] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const r = await authService.me();
      setUser(r.user);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setInitializing(false));
  }, [refreshUser]);

  // Phiên hết hạn hoặc tài khoản bị khóa trong lúc đang dùng → xóa phiên phía giao diện (UC03 ngoại lệ)
  useEffect(
    () =>
      onUnauthorized((code) => {
        if (!getToken()) return;
        setToken(null);
        setUser(null);
        setNotice(code === 'ACCOUNT_LOCKED' ? 'Tài khoản của bạn đã bị khóa.' : 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const r = await authService.login({ email, password });
    setToken(r.token);
    setUser(r.user);
    setNotice(null);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ user, initializing, sessionNotice, clearNotice: () => setNotice(null), login, logout, refreshUser, hasRole: (...roles) => !!user && roles.includes(user.role) }),
    [user, initializing, sessionNotice, login, logout, refreshUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}

export const isAdminRole = (r?: Role) => r === 'admin' || r === 'super_admin';
