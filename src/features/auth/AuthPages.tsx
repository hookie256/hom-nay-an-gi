import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Field, Icon, Input } from '@/components/ui';
import { isAdminRole, useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services';
import { ApiRequestError, isMockApi } from '@/services/apiClient';
import { EMAIL_RE } from '@/domain/text';
import { useDocumentTitle } from '@/hooks/misc';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="card__body stack">
          <div>
            <span className="brand__logo" aria-hidden><Icon name="utensils" size={18} /></span>
            <h1 style={{ marginTop: 12 }}>{title}</h1>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="card__footer small" style={{ textAlign: 'center' }}>{footer}</div>}
      </div>
    </div>
  );
}

/** Chỉ cho phép chuyển hướng nội bộ để tránh open redirect. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group input-group--end">
      <input {...props} type={show ? 'text' : 'password'} className="input" />
      <button type="button" className="input-group__end" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={show}>
        <Icon name={show ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

// ---------- UC02 ----------
export function LoginPage() {
  useDocumentTitle('Đăng nhập');
  const { login, user } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reason = (location.state as { reason?: string } | null)?.reason;
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next ?? (isAdminRole(user.role) ? '/admin' : '/')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!email.trim()) fe.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(email.trim())) fe.email = 'Email chưa đúng định dạng.';
    if (!password) fe.password = 'Vui lòng nhập mật khẩu.';
    setErrors(fe);
    setFormError(null);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      const u = await login(email, password);
      // Đưa người dùng trở lại trang trước đó (UC02)
      navigate(next ?? (isAdminRole(u.role) ? '/admin' : '/'), { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Đăng nhập" subtitle="Lưu món yêu thích, cá nhân hóa gợi ý và đặt món." footer={<>Chưa có tài khoản? <Link to={`/dang-ky${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Đăng ký</Link></>}>
      {reason && <Alert tone="info">{reason}</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Email" required error={errors.email}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Mật khẩu" required error={errors.password}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="row-between small">
          <span />
          <Link to="/quen-mat-khau">Quên mật khẩu?</Link>
        </div>
        <Button type="submit" variant="primary" block size="lg" loading={busy}>Đăng nhập</Button>
      </form>
      {isMockApi && (
        <details className="subtle">
          <summary>Tài khoản dùng thử (chế độ mock)</summary>
          <p style={{ marginTop: 8 }}>Xem danh sách tài khoản thử và mật khẩu trong tệp README của project.</p>
        </details>
      )}
    </AuthShell>
  );
}

// ---------- UC01 ----------
export function RegisterPage() {
  useDocumentTitle('Đăng ký');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!form.name.trim()) fe.name = 'Vui lòng nhập tên.';
    if (!EMAIL_RE.test(form.email.trim())) fe.email = form.email.trim() ? 'Email chưa đúng định dạng.' : 'Vui lòng nhập email.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) fe.password = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.';
    if (form.confirm !== form.password) fe.confirm = 'Mật khẩu nhập lại không khớp.';
    setErrors(fe);
    setFormError(null);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await authService.register({ name: form.name, email: form.email, password: form.password });
      await login(form.email, form.password);
      navigate(next ?? '/tai-khoan/so-thich', { replace: true, state: { welcome: true } });
    } catch (err) {
      // Giữ nguyên biểu mẫu và nêu lỗi (UC01 ngoại lệ)
      if (err instanceof ApiRequestError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Tạo tài khoản" subtitle="Miễn phí. Chỉ cần tên, email và mật khẩu." footer={<>Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></>}>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Tên hiển thị" required error={errors.name}><Input autoComplete="name" value={form.name} onChange={set('name')} maxLength={60} /></Field>
        <Field label="Email" required error={errors.email}><Input type="email" autoComplete="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Mật khẩu" required error={errors.password} hint="Ít nhất 8 ký tự, gồm cả chữ và số."><PasswordInput autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <Field label="Nhập lại mật khẩu" required error={errors.confirm}><PasswordInput autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></Field>
        <Button type="submit" variant="primary" block size="lg" loading={busy}>Đăng ký</Button>
      </form>
    </AuthShell>
  );
}

// ---------- UC05 ----------
export function ForgotPasswordPage() {
  useDocumentTitle('Quên mật khẩu');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<{ message: string; devResetLink?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError('Vui lòng nhập email hợp lệ.');
    setError(undefined);
    setBusy(true);
    try {
      setDone(await authService.forgotPassword(email));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Quên mật khẩu" subtitle="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu." footer={<Link to="/dang-nhap">Quay lại đăng nhập</Link>}>
      {done ? (
        <div className="stack">
          <Alert tone="success">{done.message}</Alert>
          {done.devResetLink && (
            <Alert tone="warning" title="Chế độ chạy thử">
              Chưa có dịch vụ gửi email nên liên kết được hiển thị tại đây: <Link to={done.devResetLink}>Mở liên kết đặt lại mật khẩu</Link> (hiệu lực 30 phút, dùng một lần).
            </Alert>
          )}
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Email" required error={error}><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Button type="submit" variant="primary" block loading={busy}>Gửi liên kết</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  useDocumentTitle('Đặt lại mật khẩu');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) fe.password = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.';
    if (confirm !== pw) fe.confirm = 'Mật khẩu nhập lại không khớp.';
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await authService.resetPassword(token, pw);
      setOk(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!token) return <AuthShell title="Liên kết không hợp lệ" footer={<Link to="/quen-mat-khau">Gửi lại liên kết</Link>}><Alert tone="danger">Liên kết đặt lại mật khẩu thiếu mã xác thực.</Alert></AuthShell>;
  return (
    <AuthShell title="Đặt mật khẩu mới" footer={<Link to="/dang-nhap">Quay lại đăng nhập</Link>}>
      {ok ? (
        <div className="stack">
          <Alert tone="success">Đã đổi mật khẩu. Các phiên đăng nhập cũ đã bị đăng xuất.</Alert>
          <Link to="/dang-nhap" className="btn btn--primary btn--block">Đăng nhập</Link>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {formError && <Alert tone="danger" action={<Link to="/quen-mat-khau" className="btn btn--sm">Gửi lại</Link>}>{formError}</Alert>}
          <Field label="Mật khẩu mới" required error={errors.password} hint="Ít nhất 8 ký tự, gồm cả chữ và số."><PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Nhập lại mật khẩu" required error={errors.confirm}><PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <Button type="submit" variant="primary" block loading={busy}>Lưu mật khẩu</Button>
        </form>
      )}
    </AuthShell>
  );
}
