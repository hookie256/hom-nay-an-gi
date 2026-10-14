/** Lấy giờ/phút hiện tại theo múi giờ cấu hình (không phụ thuộc múi giờ máy). */
export function zonedTime(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

/** "HH:mm" -> số phút trong ngày; trả về NaN nếu sai định dạng. */
export function parseHHmm(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}
