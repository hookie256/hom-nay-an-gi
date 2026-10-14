import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, Loading, ButtonLink } from '@/components/ui';

/** Chặn trang cần đăng nhập ở giao diện; máy chủ vẫn kiểm tra lại mọi yêu cầu (UC06). */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <Loading />;
  if (!user) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container page">
        <EmptyState icon="shield" title="Bạn không có quyền truy cập trang này" action={<ButtonLink to="/" variant="primary">Về trang chủ</ButtonLink>}>
          Trang này chỉ dành cho tài khoản có vai trò phù hợp.
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}
