import type { OrderEvent, OrderStatus, PaymentStatus } from '@/types/models';
import { Badge, Icon } from '@/components/ui';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/domain/constants';
import { formatDateTime } from '@/utils/format';

const ORDER_TONE: Record<OrderStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning', confirmed: 'info', preparing: 'primary', completed: 'success', rejected: 'danger', cancelled: 'danger',
};
const PAY_TONE: Record<PaymentStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  unpaid: 'warning', processing: 'info', paid: 'success', failed: 'danger', refund_pending: 'warning', refunded: 'info',
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Badge tone={PAY_TONE[status]} icon="info">{PAYMENT_STATUS_LABEL[status]}</Badge>;

/** Các mốc chuyển trạng thái đơn (order_events) – UC51. */
export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) return <p className="muted small">Chưa có mốc trạng thái.</p>;
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e._id} className="timeline__item">
          <span className="timeline__dot" aria-hidden><Icon name={e.toStatus === 'cancelled' || e.toStatus === 'rejected' ? 'x' : 'check'} size={12} /></span>
          <div>
            <strong>{e.fromStatus === e.toStatus ? 'Cập nhật thanh toán' : ORDER_STATUS_LABEL[e.toStatus]}</strong>
            <div className="subtle">{formatDateTime(e.createdAt)}</div>
            {e.reason && <div className="small">Lý do: {e.reason}</div>}
            {e.note && <div className="small muted">{e.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
