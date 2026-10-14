import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OrderDetail } from '@/types/api';
import { Alert, Button, ButtonLink, EmptyState, ErrorState, Field, Icon, Loading, Modal, PageHeader, Pagination, TextArea } from '@/components/ui';
import { orderService } from '@/services';
import { ApiRequestError } from '@/services/apiClient';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { PAYMENT_METHOD_LABEL } from '@/domain/constants';
import { formatDateTime, formatPrice } from '@/utils/format';
import { OrderStatusBadge, OrderTimeline, PaymentBadge } from './OrderBits';

/** Kết quả đặt hàng thành công: mã đơn, món, tổng tiền, thanh toán, trạng thái (6.14). */
export function OrderSuccessPage() {
  useDocumentTitle('Đặt hàng thành công');
  const { id = '' } = useParams();
  const q = useQuery(() => orderService.get(id), [id]);
  if (q.loading) return <div className="container page"><Loading /></div>;
  if (q.error) return <div className="container page"><ErrorState message={q.error.message} onRetry={q.reload} /></div>;
  const o = q.data!;
  return (
    <div className="container page narrow">
      <div className="card card__body stack success-card">
        <div className="success-card__icon" aria-hidden><Icon name="checkCircle" size={40} /></div>
        <h1>Đặt hàng thành công</h1>
        <p className="muted">Mã đơn của bạn là <strong className="code">{o.code}</strong>. Đơn đang chờ cửa hàng xác nhận.</p>
        <OrderSummary order={o} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <ButtonLink to={`/tai-khoan/don-hang/${o._id}`} variant="primary">Theo dõi đơn</ButtonLink>
          <ButtonLink to="/">Về trang chủ</ButtonLink>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: OrderDetail }) {
  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Món</th><th className="num">Đơn giá</th><th className="num">SL</th><th className="num">Thành tiền</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.dishId}><td>{i.snapshotName}</td><td className="num">{formatPrice(i.unitPrice)}</td><td className="num">{i.quantity}</td><td className="num">{formatPrice(i.lineTotal)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}><strong>Tổng cộng</strong></td><td className="num"><strong>{formatPrice(order.total)}</strong></td></tr></tfoot>
        </table>
      </div>
      <dl className="dl">
        <dt>Trạng thái đơn</dt><dd><OrderStatusBadge status={order.orderStatus} /></dd>
        <dt>Thanh toán</dt><dd>{PAYMENT_METHOD_LABEL[order.paymentMethod]} · <PaymentBadge status={order.paymentStatus} /></dd>
        <dt>Người nhận</dt><dd>{order.receiveInfo.receiverName} · {order.receiveInfo.phone}</dd>
        <dt>Nhận món</dt><dd>{order.receiveInfo.method === 'delivery' ? `Giao tới: ${order.receiveInfo.address}` : 'Tự đến lấy'}</dd>
        {order.receiveInfo.note && <><dt>Ghi chú</dt><dd>{order.receiveInfo.note}</dd></>}
        <dt>Thời gian đặt</dt><dd>{formatDateTime(order.createdAt)}</dd>
      </dl>
    </div>
  );
}

/** UC50 – Danh sách đơn của tôi. */
export function MyOrdersPage() {
  useDocumentTitle('Đơn hàng của tôi');
  const [page, setPage] = useState(1);
  const q = useQuery(() => orderService.list(page), [page]);
  return (
    <div className="stack">
      <PageHeader title="Đơn hàng của tôi" description="Giá hiển thị là giá đã chốt tại thời điểm đặt." />
      {q.loading && !q.data ? <Loading /> : q.error ? <ErrorState message={q.error.message} onRetry={q.reload} /> : q.data!.items.length === 0 ? (
        <EmptyState icon="package" title="Bạn chưa có đơn hàng nào" action={<ButtonLink to="/kham-pha" variant="primary">Chọn món</ButtonLink>} />
      ) : (
        <ul className="order-list">
          {q.data!.items.map((o) => (
            <li key={o._id} className="card card__body order-row">
              <div className="stack-sm">
                <div className="row"><Link to={`/tai-khoan/don-hang/${o._id}`} className="code"><strong>{o.code}</strong></Link><OrderStatusBadge status={o.orderStatus} />{o.cancelRequest?.status === 'pending' && <span className="badge badge--warning">Đang chờ duyệt hủy</span>}</div>
                <span className="small muted">{o.items.map((i) => `${i.snapshotName} × ${i.quantity}`).join(', ')}</span>
                <span className="subtle">{formatDateTime(o.createdAt)}</span>
              </div>
              <div className="order-row__right">
                <strong>{formatPrice(o.total)}</strong>
                <ButtonLink size="sm" to={`/tai-khoan/don-hang/${o._id}`} iconRight="chevronRight">Chi tiết</ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
    </div>
  );
}

/** UC50–UC52 – Chi tiết, theo dõi trạng thái, yêu cầu hủy. */
export function MyOrderDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery(() => orderService.get(id), [id]);
  useDocumentTitle(q.data ? `Đơn ${q.data.code}` : 'Chi tiết đơn');
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) {
    // Lỗi tải thì không tự suy ra trạng thái (UC51)
    return q.error.status === 404 ? (
      <EmptyState icon="package" title="Không tìm thấy đơn hàng" action={<ButtonLink to="/tai-khoan/don-hang">Về danh sách đơn</ButtonLink>}>Đơn không tồn tại hoặc không thuộc tài khoản của bạn.</EmptyState>
    ) : <ErrorState message={q.error.message} onRetry={q.reload} />;
  }
  const o = q.data!;

  const submitCancel = async () => {
    if (!reason.trim()) return setError('Vui lòng nhập lý do hủy.');
    setBusy(true);
    try {
      const r = await orderService.cancel(o._id, reason.trim());
      toast.success(r.result === 'cancelled' ? 'Đơn đã được hủy.' : 'Đã gửi yêu cầu hủy. Vui lòng chờ cửa hàng xử lý.');
      setCancelOpen(false);
      q.setData(r.order);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'CANCEL_NOT_ALLOWED') {
        toast.error(e.message);
        setCancelOpen(false);
        q.reload();
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Link to="/tai-khoan/don-hang" className="small"><Icon name="chevronLeft" size={14} /> Đơn hàng của tôi</Link>
      <PageHeader title={<>Đơn <span className="code">{o.code}</span></>} actions={
        <>
          <Button icon="refresh" onClick={q.reload} loading={q.loading}>Cập nhật</Button>
          {o.cancelMode !== 'not_allowed' && <Button variant="danger-outline" onClick={() => { setReason(''); setError(undefined); setCancelOpen(true); }}>{o.cancelMode === 'direct' ? 'Hủy đơn' : 'Yêu cầu hủy'}</Button>}
        </>
      } />
      {o.orderStatus === 'rejected' && <Alert tone="danger" title="Đơn bị từ chối">{o.rejectReason}</Alert>}
      {o.cancelRequest && (
        <Alert tone={o.cancelRequest.status === 'pending' ? 'warning' : o.cancelRequest.status === 'approved' ? 'success' : 'info'} title={o.cancelRequest.status === 'pending' ? 'Yêu cầu hủy đang chờ xử lý' : o.cancelRequest.status === 'approved' ? 'Yêu cầu hủy đã được chấp thuận' : 'Yêu cầu hủy không được chấp thuận'}>
          Lý do bạn gửi: {o.cancelRequest.reason}
          {o.cancelRequest.decisionReason && <><br />Phản hồi: {o.cancelRequest.decisionReason}</>}
        </Alert>
      )}
      {o.paymentStatus === 'refund_pending' && <Alert tone="info">Đơn đã thanh toán và đang chờ hoàn tiền.</Alert>}
      <div className="grid-2">
        <section className="card card__body"><h2 className="h3">Thông tin đơn</h2><OrderSummary order={o} /></section>
        <section className="card card__body"><h2 className="h3">Tiến trình</h2><OrderTimeline events={o.events} /></section>
      </div>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={o.cancelMode === 'direct' ? 'Hủy đơn hàng' : 'Gửi yêu cầu hủy'} closeDisabled={busy} footer={
        <><Button onClick={() => setCancelOpen(false)} disabled={busy}>Không hủy</Button><Button variant="danger" onClick={submitCancel} loading={busy}>{o.cancelMode === 'direct' ? 'Hủy đơn' : 'Gửi yêu cầu'}</Button></>
      }>
        <div className="stack">
          <p className="muted">{o.cancelMode === 'direct' ? 'Đơn chưa được cửa hàng tiếp nhận nên sẽ được hủy ngay.' : 'Đơn đã được xác nhận. Yêu cầu hủy cần cửa hàng xem xét; đơn chưa bị hủy cho đến khi được chấp thuận.'}</p>
          <Field label="Lý do hủy" required error={error}><TextArea value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} maxLength={300} data-autofocus /></Field>
        </div>
      </Modal>
    </div>
  );
}
