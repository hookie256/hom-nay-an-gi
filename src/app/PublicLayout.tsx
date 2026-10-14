import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Icon } from '@/components/ui';
import { isAdminRole, useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { isMockApi } from '@/services/apiClient';

const NAV = [
  { to: '/', label: 'Hôm nay ăn gì?', icon: 'sparkles', end: true },
  { to: '/nguyen-lieu', label: 'Theo nguyên liệu', icon: 'carrot' },
  { to: '/kham-pha', label: 'Khám phá món', icon: 'grid' },
];

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);
  if (!user) return null;
  const name = user.displayName || user.email;
  const close = () => setOpen(false);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden>{name[0]?.toUpperCase()}</span>
        <span className="avatar-btn__name">{name}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <ul className="menu" role="menu">
          <li className="menu__label" role="presentation">{user.email}</li>
          {user.role === 'user' ? (
            <>
              <li role="none"><Link role="menuitem" className="menu__item" to="/tai-khoan/ho-so" onClick={close}><Icon name="user" size={16} /> Hồ sơ & sở thích</Link></li>
              <li role="none"><Link role="menuitem" className="menu__item" to="/tai-khoan/yeu-thich" onClick={close}><Icon name="heart" size={16} /> Món yêu thích</Link></li>
              <li role="none"><Link role="menuitem" className="menu__item" to="/tai-khoan/lich-su" onClick={close}><Icon name="history" size={16} /> Lịch sử</Link></li>
              <li role="none"><Link role="menuitem" className="menu__item" to="/tai-khoan/don-hang" onClick={close}><Icon name="package" size={16} /> Đơn hàng của tôi</Link></li>
            </>
          ) : (
            <li role="none"><Link role="menuitem" className="menu__item" to="/admin" onClick={close}><Icon name="settings" size={16} /> Trang quản trị</Link></li>
          )}
          <li className="menu__sep" role="separator" />
          <li role="none">
            <button role="menuitem" type="button" className="menu__item" onClick={async () => { close(); await logout(); navigate('/'); }}>
              <Icon name="logout" size={16} /> Đăng xuất
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, initializing } = useAuth();
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label="Hôm Nay Ăn Gì? – Trang chủ">
          <span className="brand__logo" aria-hidden><Icon name="utensils" size={18} /></span>
          <span className="brand__name">Hôm Nay Ăn Gì?</span>
        </Link>
        <nav className={['main-nav', mobileOpen && 'main-nav--open'].filter(Boolean).join(' ')} aria-label="Điều hướng chính" id="main-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="main-nav__link">
              <Icon name={n.icon} size={17} /> {n.label}
            </NavLink>
          ))}
          {user && isAdminRole(user.role) && (
            <NavLink to="/admin" className="main-nav__link"><Icon name="settings" size={17} /> Quản trị</NavLink>
          )}
        </nav>
        <div className="site-header__actions">
          {(!user || user.role === 'user') && (
            <Link to="/gio-hang" className="icon-link" aria-label={`Giỏ hàng${count ? `, ${count} món` : ''}`}>
              <Icon name="cart" size={22} />
              {count > 0 && <span className="icon-link__badge" aria-hidden>{count > 99 ? '99+' : count}</span>}
            </Link>
          )}
          {!initializing && (user ? <AccountMenu /> : (
            <div className="row auth-links">
              <Link to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} className="btn btn--ghost btn--sm">Đăng nhập</Link>
              <Link to="/dang-ky" className="btn btn--primary btn--sm">Đăng ký</Link>
            </div>
          ))}
          <Button className="nav-toggle" variant="ghost" iconOnly icon={mobileOpen ? 'x' : 'menu'} aria-label="Mở menu" aria-expanded={mobileOpen} aria-controls="main-nav" onClick={() => setMobileOpen((o) => !o)} />
        </div>
      </div>
    </header>
  );
}

function SessionNotice() {
  const { sessionNotice, clearNotice } = useAuth();
  const location = useLocation();
  if (!sessionNotice) return null;
  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <Alert tone="warning" action={<Button size="sm" variant="ghost" onClick={clearNotice}>Đóng</Button>}>
        {sessionNotice} <Link to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} onClick={clearNotice}>Đăng nhập lại</Link>
      </Alert>
    </div>
  );
}

export function PublicLayout() {
  return (
    <>
      <a href="#main" className="skip-link">Bỏ qua đến nội dung chính</a>
      <SiteHeader />
      <SessionNotice />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            <strong>Hôm Nay Ăn Gì?</strong>
            <p className="subtle">Gợi ý món ăn theo buổi, sở thích, nguyên liệu có sẵn và đặt món.</p>
          </div>
          <nav aria-label="Liên kết chân trang" className="row">
            <Link to="/">Gợi ý theo buổi</Link>
            <Link to="/nguyen-lieu">Tìm theo nguyên liệu</Link>
            <Link to="/kham-pha">Khám phá</Link>
          </nav>
          {isMockApi && <p className="subtle">Bản chạy thử: dữ liệu được lưu trong trình duyệt (máy chủ giả). Thời gian nấu là ước tính; dữ liệu món là dữ liệu mẫu.</p>}
        </div>
      </footer>
    </>
  );
}
