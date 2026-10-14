import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { CartView, CreateOrderRequest } from '@/types/api';
import { Alert, Button, Field, Input, Loading, PageHeader, TextArea, ErrorState } from '@/components/ui';
import { cartService, orderService, profileService } from '@/services';
import { ApiRequestError } from '@/services/apiClient';
import { useCart } from '@/contexts/CartContext';
import { useDocumentTitle } from '@/hooks/misc';
import { formatPrice, newIdempotencyKey } from '@/utils/format';
import { PHONE_RE } from '@/domain/text';

/** UC47–UC48: nhập thông tin nhận món, chọn thanh toán, xác nhận tạo đơn. */
export function CheckoutPage() {
  useDocumentTitle('Đặt hàng');
  const navigate = useNavigate();
  const { refresh } = useCart();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ receiverName: '', phone: '', method: 'delivery' as 'delivery' | 'pickup', address: '', note: '', paymentMethod: 'cod' as 'cod' | 'online' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ message: string; cartChanged?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Mỗi lần mở trang xác nhận dùng một mã yêu cầu: nhấn nhiều lần không tạo nhiều đơn (RR07)
  const idemKey = useRef(newIdempotencyKey());

  useEffect(() => {
    cartService.get().then(setCart).catch((e) => setLoadError((e as Error).message));
    profileService.get().then((p) => setForm((f) => ({ ...f, receiverName: f.receiverName || p.profile.displayName || '' }))).catch(() => undefined);
  }, []);

  if (loadError) return <div className="container page"><ErrorState message={loadError} /></div>;
  if (!cart) return <div className="container page"><Loading /></div>;
  if (cart.items.length === 0) return <Navigate to="/gio-hang" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!form.receiverName.trim()) fe['receiveInfo.receiverName'] = 'Vui lòng nhập tên người nhận.';
    if (!PHONE_RE.test(form.phone.replace(/\s|\./g, ''))) fe['receiveInfo.phone'] = 'Số điện thoại chưa đúng, ví dụ 0901234567.';
    if (form.method === 'delivery' && form.address.trim().length < 10) fe['receiveInfo.address'] = 'Vui lòng nhập địa chỉ nhận món đầy đủ.';
    setErrors(fe);
    setFormError(null);
    if (Object.keys(fe).length) {
      document.getElementById(Object.keys(fe)[0])?.focus();
      return;
    }
    setBusy(true);
    const req: CreateOrderRequest = {
      receiveInfo: { receiverName: form.receiverName.trim(), phone: form.phone.trim(), method: form.method, address: form.method === 'delivery' ? form.address.trim() : undefined, note: form.note.trim() || undefined },
      paymentMethod: form.paymentMethod,
      idempotencyKey: idemKey.current,
    };
    try {
      const order = await orderService.create(req);
      await refresh();
      navigate(`/dat-hang/thanh-cong/${order._id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.fieldErrors) setErrors(err.fieldErrors);
        setFormError({ message: err.message, cartChanged: err.code === 'CART_CHANGED' });
        if (err.code === 'CART_CHANGED') cartService.get().then(setCart).catch(() => undefined);
      } else setFormError({ message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <PageHeader title="Xác nhận đặt hàng" description="Kiểm tra món và nhập thông tin nhận món." />
      <form className="cart-layout" onSubmit={submit} noValidate>
        <div className="stack">
          {formError && (
            <Alert tone="danger" title="Chưa tạo được đơn" action={formError.cartChanged ? <Link className="btn btn--sm" to="/gio-hang">Xem lại giỏ</Link> : undefined}>{formError.message}</Alert>
          )}
          <fieldset className="fieldset stack">
            <legend>Thông tin nhận món</legend>
            <div className="form-grid form-grid--2">
              <Field label="Tên người nhận" required error={errors['receiveInfo.receiverName']}><Input id="receiveInfo.receiverName" autoComplete="name" value={form.receiverName} onChange={set('receiverName')} /></Field>
              <Field label="Số điện thoại" required error={errors['receiveInfo.phone']}><Input id="receiveInfo.phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0901234567" /></Field>
            </div>
            <div role="radiogroup" aria-label="Hình thức nhận món" className="option-cards">
              {([['delivery', 'Giao tận nơi', 'Nhập địa chỉ nhận món'], ['pickup', 'Tự đến lấy', 'Nhận tại quầy theo giờ hẹn']] as const).map(([v, l, d]) => (
                <label key={v} className={['option-card', form.method === v && 'option-card--active'].filter(Boolean).join(' ')}>
                  <input type="radio" name="method" value={v} checked={form.method === v} onChange={() => setForm((f) => ({ ...f, method: v }))} />
                  <span><strong>{l}</strong><span className="subtle" style={{ display: 'block' }}>{d}</span></span>
                </label>
              ))}
            </div>
            {form.method === 'delivery' && (
              <Field label="Địa chỉ nhận món" required error={errors['receiveInfo.address']}><Input id="receiveInfo.address" autoComplete="street-address" value={form.address} onChange={set('address')} placeholder="Số nhà, đường, phường/xã, quận/huyện" /></Field>
            )}
            <Field label="Ghi chú cho đơn (không bắt buộc)"><TextArea value={form.note} onChange={set('note')} maxLength={300} placeholder="Ví dụ: ít cay, gọi trước khi giao" /></Field>
            <p className="subtle" style={{ margin: 0 }}>Website chỉ ghi nhận đơn và trạng thái; việc giao món do đơn vị bán thực hiện.</p>
          </fieldset>
          <fieldset className="fieldset stack">
            <legend>Thanh toán</legend>
            <div role="radiogroup" aria-label="Hình thức thanh toán" className="option-cards">
              <label className={['option-card', form.paymentMethod === 'cod' && 'option-card--active'].filter(Boolean).join(' ')}>
                <input type="radio" name="payment" checked={form.paymentMethod === 'cod'} onChange={() => setForm((f) => ({ ...f, paymentMethod: 'cod' }))} />
                <span><strong>Thanh toán khi nhận món</strong><span className="subtle" style={{ display: 'block' }}>Trả tiền mặt khi nhận.</span></span>
              </label>
              <label className="option-card option-card--disabled">
                <input type="radio" name="payment" disabled />
                <span><strong>Thanh toán trực tuyến</strong><span className="subtle" style={{ display: 'block' }}>Chưa được tích hợp.</span></span>
              </label>
            </div>
          </fieldset>
        </div>
        <aside className="card card__body stack cart-summary" aria-label="Đơn hàng">
          <h2 className="h3">Đơn hàng</h2>
          <ul className="summary-list">
            {cart.items.map((l) => (
              <li key={l.dishId} className="row-between small"><span>{l.name} × {l.quantity}</span><span>{formatPrice(l.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="row-between"><strong>Tổng tạm tính</strong><strong className="price-lg">{formatPrice(cart.subtotal)}</strong></div>
          {!cart.ok && <Alert tone="warning">Giỏ hàng có thay đổi. <Link to="/gio-hang">Xem lại giỏ</Link> trước khi đặt.</Alert>}
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!cart.ok}>Xác nhận đặt hàng</Button>
          <p className="subtle" style={{ margin: 0 }}>Giá và tình trạng món được máy chủ kiểm tra lại khi bạn xác nhận.</p>
        </aside>
      </form>
    </div>
  );
}
