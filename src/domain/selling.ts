import type { OrderSettings, SellingMenu, TimeRange } from '@/types/models';
import { parseHHmm, zonedTime } from './time';

export type NotOrderableReason = 'not_selling' | 'unavailable' | 'not_yet_valid' | 'expired' | 'outside_hours' | 'dish_unpublished';

export const NOT_ORDERABLE_MESSAGE: Record<NotOrderableReason, string> = {
  not_selling: 'Món này hiện không được bán trên website.',
  unavailable: 'Món đang tạm hết hoặc tạm ngừng nhận đặt.',
  not_yet_valid: 'Món chưa đến thời gian mở bán.',
  expired: 'Món đã hết thời gian bán.',
  outside_hours: 'Hiện ngoài khung giờ nhận đơn.',
  dish_unpublished: 'Món không còn được công khai.',
};

/** Kiểm tra một thời điểm có nằm trong các khung giờ (hỗ trợ khung qua nửa đêm). */
export function isWithinHours(ranges: TimeRange[], now: Date, timeZone: string): boolean {
  if (ranges.length === 0) return false;
  const { hour, minute } = zonedTime(now, timeZone);
  const t = hour * 60 + minute;
  return ranges.some((r) => {
    const s = parseHHmm(r.start);
    const e = parseHHmm(r.end);
    if (Number.isNaN(s) || Number.isNaN(e) || s === e) return false;
    return s < e ? t >= s && t < e : t >= s || t < e;
  });
}

export function effectiveHours(menu: SellingMenu, settings: OrderSettings): TimeRange[] {
  return menu.receivingHours && menu.receivingHours.length > 0 ? menu.receivingHours : settings.defaultReceivingHours;
}

/** Món có đặt được tại thời điểm `now` hay không (UC26, UC44, UC46). */
export function checkOrderable(
  menu: SellingMenu | undefined,
  settings: OrderSettings,
  now: Date,
  dishPublished = true,
): { orderable: true } | { orderable: false; reason: NotOrderableReason } {
  if (!dishPublished) return { orderable: false, reason: 'dish_unpublished' };
  if (!menu) return { orderable: false, reason: 'not_selling' };
  if (!menu.available) return { orderable: false, reason: 'unavailable' };
  if (new Date(menu.validFrom) > now) return { orderable: false, reason: 'not_yet_valid' };
  if (menu.validTo && new Date(menu.validTo) <= now) return { orderable: false, reason: 'expired' };
  if (!isWithinHours(effectiveHours(menu, settings), now, settings.timezone)) return { orderable: false, reason: 'outside_hours' };
  return { orderable: true };
}

/** Kiểm tra danh sách khung giờ hợp lệ (UC79). Trả về thông báo lỗi hoặc null. */
export function validateTimeRanges(ranges: TimeRange[]): string | null {
  if (ranges.length === 0) return 'Cần ít nhất một khung giờ nhận đơn.';
  for (const r of ranges) {
    const s = parseHHmm(r.start);
    const e = parseHHmm(r.end);
    if (Number.isNaN(s) || Number.isNaN(e)) return 'Giờ phải theo định dạng HH:mm, ví dụ 07:30.';
    if (s === e) return 'Giờ bắt đầu và kết thúc không được trùng nhau.';
  }
  return null;
}
