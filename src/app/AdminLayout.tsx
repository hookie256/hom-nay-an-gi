import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button, Icon } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABEL } from '@/domain/constants';

const GROUPS = [
  { label: 'Tổng quan', items: [{ to: '/admin', label: 'Thống kê', icon: 'chart', end: true }] },
  {
    label: 'Nội dung',
    items: [
      { to: '/admin/mon-an', label: 'Món ăn & công thức', icon: 'book' },
      { to: '/admin/nguyen-lieu', label: 'Nguyên liệu', icon: 'carrot' },
      { to: '/admin/don-vi', label: 'Đơn vị tính', icon: 'scale' },
      { to: '/admin/danh-muc', label: 'Danh mục', icon: 'tag' },
      { to: '/admin/danh-gia', label: 'Kiểm duyệt đánh giá', icon: 'message' },
    ],
  },
  {
    label: 'Bán hàng',
    items: [
      { to: '/admin/thuc-don-ban', label: 'Thực đơn bán hàng', icon: 'store' },
      { to: '/admin/don-hang', label: 'Đơn hàng', icon: 'package' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { to: '/admin/tai-khoan', label: 'Tài khoản', icon: 'users' },
      { to: '/admin/nhat-ky', label: 'Lịch sử quản trị', icon: 'shield', superOnly: true },
      { to: '/admin/du-lieu', label: 'Sao lưu dữ liệu thử', icon: 'download', superOnly: true },
    ],
  },
];

export function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className="admin-layout">
      <a href="#admin-main" className="skip-link">Bỏ qua đến nội dung chính</a>
      <aside className={['admin-sidebar', open && 'admin-sidebar--open'].filter(Boolean).join(' ')} id="admin-sidebar">
        <Link to="/" className="brand brand--light"><span className="brand__logo" aria-hidden><Icon name="utensils" size={18} /></span><span className="brand__name">Hôm Nay Ăn Gì?</span></Link>
        <nav aria-label="Quản trị">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => !('superOnly' in i && i.superOnly) || user?.role === 'super_admin');
            if (!items.length) return null;
            return (
              <div key={g.label} className="admin-nav-group">
                <div className="admin-nav-group__label">{g.label}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={'end' in i ? i.end : false} className="admin-nav__link">
                    <Icon name={i.icon} size={18} /> {i.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <Button className="admin-menu-toggle" variant="ghost" iconOnly icon={open ? 'x' : 'menu'} aria-label="Mở menu quản trị" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen((o) => !o)} />
          <div className="row" style={{ marginLeft: 'auto' }}>
            <span className="subtle">{user?.email} · {user ? ROLE_LABEL[user.role] : ''}</span>
            <Link to="/" className="btn btn--sm"><Icon name="home" size={15} /> Về trang người dùng</Link>
          </div>
        </header>
        <main id="admin-main" className="admin-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {open && <div className="admin-overlay" onClick={() => setOpen(false)} aria-hidden />}
    </div>
  );
}
