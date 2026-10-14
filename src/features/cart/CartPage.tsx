import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CartView } from '@/types/api';
import { Alert, Button, ButtonLink, EmptyState, ErrorState, Icon, Loading, PageHeader, QuantityStepper } from '@/components/ui';
import { DishImage } from '@/components/dish/DishImage';
import { cartService } from '@/services';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/misc';
import { formatPrice } from '@/utils/format';

/** UC44–UC46: giỏ hàng, cập nhật số lượng, xem lại thay đổi giá/tình trạng trước khi đặt. */
export function CartPage() {
  useDocumentTitle('Giỏ hàng');
  const { setCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [cart, setLocal] = useState<CartView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = (c: CartView) => { setLocal(c); setCart(c); };
  const load = () => { setError(null); cartService.get().then(apply).catch((e) => setError((e as Error).message)); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<CartView>, ok?: string) => {
    setBusy(key);
    try {
      apply(await fn());
      if (ok) toast.success(ok);
    } catch (e) {
      // Số lượng không hợp lệ → khôi phục giá trị trước (dữ liệu giữ nguyên từ máy chủ)
      toast.error((e as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (error && !cart) return <div className="container page"><ErrorState message={error} onRetry={load} /></div>;
  if (!cart) return <div className="container page"><Loading /></div>;
  const priceChanged = cart.issues.some((i) => i.type === 'price_changed');
  const notOrderable = cart.issues.some((i) => i.type === 'not_orderable');

  return (
    <div className="container page">
      <PageHeader title="Giỏ hàng" description="Giá trong giỏ là giá tạm tính, được kiểm tra lại khi bạn đặt hàng." />
      {cart.items.length === 0 ? (
        <EmptyState icon="cart" title="Giỏ hàng đang trống" action={<ButtonLink to="/kham-pha" variant="primary">Chọn món</ButtonLink>}>Chỉ những món có nhãn “Có bán” mới có thể đặt.</EmptyState>
      ) : (
        <div className="cart-layout">
          <section aria-label="Các món trong giỏ" className="stack">
            {cart.issues.length > 0 && (
              <Alert tone="warning" title="Giỏ hàng có thay đổi cần bạn xem lại" action={
                <div className="stack-sm">
                  {priceChanged && <Button size="sm" variant="primary" loading={busy === 'confirm'} onClick={() => run('confirm', cartService.confirmPrices, 'Đã cập nhật theo giá mới.')}>Đồng ý giá mới</Button>}
                  {notOrderable && <Button size="sm" loading={busy === 'clean'} onClick={() => run('clean', cartService.removeUnavailable, 'Đã bỏ các món không thể đặt.')}>Bỏ món không đặt được</Button>}
                </div>
              }>
                Giá hoặc tình trạng bán của một số món đã thay đổi kể từ khi bạn thêm vào giỏ.
              </Alert>
            )}
            <ul className="cart-list card">
              {cart.items.map((l) => (
                <li key={l.dishId} className={['cart-line', !l.orderable && 'cart-line--disabled'].filter(Boolean).join(' ')}>
                  <DishImage src={l.image} name={l.name} className="cart-line__img" />
                  <div className="cart-line__info">
                    <Link to={`/mon/${l.slug}`} className="cart-line__name">{l.name}</Link>
                    <div className="small">
                      {formatPrice(l.unitPrice)} / phần
                      {l.seenPrice !== undefined && l.unitPrice !== null && l.seenPrice !== l.unitPrice && <span className="muted"> (trước đó <s>{formatPrice(l.seenPrice)}</s>)</span>}
                    </div>
                    {l.issue && <div className="field__error"><Icon name="alert" size={14} /> {l.issue}</div>}
                  </div>
                  <QuantityStepper value={l.quantity} min={1} max={cart.maxQuantityPerItem} disabled={busy !== null} label={`Số lượng ${l.name}`} onChange={(v) => run(l.dishId, () => cartService.update(l.dishId, v))} />
                  <div className="cart-line__total">{l.orderable ? formatPrice(l.lineTotal) : <span className="muted" aria-label="Không tính vào tạm tính">—</span>}</div>
                  <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Xóa ${l.name} khỏi giỏ`} onClick={() => run(`rm-${l.dishId}`, () => cartService.remove(l.dishId), `Đã xóa “${l.name}” khỏi giỏ.`)} loading={busy === `rm-${l.dishId}`} />
                </li>
              ))}
            </ul>
          </section>
          <aside className="card card__body stack cart-summary" aria-label="Tóm tắt">
            <h2 className="h3">Tạm tính</h2>
            <div className="row-between"><span className="muted">{cart.items.reduce((s, i) => s + i.quantity, 0)} phần</span><strong className="price-lg">{formatPrice(cart.subtotal)}</strong></div>
            <p className="subtle" style={{ margin: 0 }}>Chưa gồm phí giao (nếu có). Tổng tiền cuối cùng được máy chủ tính lại khi đặt.</p>
            <Button variant="primary" size="lg" block disabled={!cart.ok || busy !== null} onClick={() => navigate('/dat-hang')}>Tiến hành đặt hàng</Button>
            {!cart.ok && <p className="field__error" style={{ margin: 0 }}><Icon name="alert" size={14} /> Hãy xử lý các thay đổi trong giỏ trước khi đặt hàng.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
