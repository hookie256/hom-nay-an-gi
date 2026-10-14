import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from '@/components/ui';

const LINKS = [
  { to: '/tai-khoan/ho-so', label: 'Hồ sơ & sở thích', icon: 'user' },
  { to: '/tai-khoan/yeu-thich', label: 'Món yêu thích', icon: 'heart' },
  { to: '/tai-khoan/lich-su', label: 'Lịch sử hoạt động', icon: 'history' },
  { to: '/tai-khoan/don-hang', label: 'Đơn hàng của tôi', icon: 'package' },
  { to: '/gio-hang', label: 'Giỏ hàng', icon: 'cart' },
];

export function AccountLayout() {
  return (
    <div className="container page account-layout">
      <nav className="side-nav" aria-label="Khu vực tài khoản">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className="side-nav__link">
            <Icon name={l.icon} size={18} /> {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="account-layout__content">
        <Outlet />
      </div>
    </div>
  );
}
