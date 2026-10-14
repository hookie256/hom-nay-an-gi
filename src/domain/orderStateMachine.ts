import type { OrderStatus, PaymentStatus } from '@/types/models';

/** Sơ đồ chuyển trạng thái đơn dành cho quản trị viên (mục 5.12, 6.24). */
const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'rejected'],
  confirmed: ['preparing'],
  preparing: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export const FINAL_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled'];

export function isFinal(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_TRANSITIONS[from].includes(to);
}

export function nextAdminStatuses(from: OrderStatus): OrderStatus[] {
  return ADMIN_TRANSITIONS[from];
}

/**
 * [GIẢ ĐỊNH] Quy tắc hủy đơn:
 *  - pending: người dùng hủy ngay (chưa được tiếp nhận).
 *  - confirmed: người dùng gửi yêu cầu hủy, quản trị viên duyệt.
 *  - preparing trở đi: không được hủy.
 */
export type CancelMode = 'direct' | 'request' | 'not_allowed';

export function userCancelMode(status: OrderStatus, hasPendingRequest: boolean): CancelMode {
  if (status === 'pending') return 'direct';
  if (status === 'confirmed' && !hasPendingRequest) return 'request';
  return 'not_allowed';
}

/** Đơn đã thanh toán mà bị từ chối/hủy thì chuyển sang chờ hoàn tiền (UC83). */
export function paymentAfterCancellation(payment: PaymentStatus): PaymentStatus {
  return payment === 'paid' ? 'refund_pending' : payment;
}

/** Chuyển trạng thái thanh toán hợp lệ do quản trị viên ghi nhận. */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ['paid'],
  processing: [],
  paid: [],
  failed: [],
  refund_pending: ['refunded'],
  refunded: [],
};

export function canAdminSetPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
