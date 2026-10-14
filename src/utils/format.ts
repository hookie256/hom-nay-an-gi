export const formatPrice = (n: number | null | undefined, currency = 'VND') =>
  n === null || n === undefined ? '—' : currency === 'VND' ? `${n.toLocaleString('vi-VN')} đ` : n.toLocaleString('vi-VN', { style: 'currency', currency });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}` : `${m} phút`);

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - Date.parse(iso)) / 60000);
  if (diff < 1) return 'vừa xong';
  if (diff < 60) return `${diff} phút trước`;
  if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
  if (diff < 1440 * 7) return `${Math.floor(diff / 1440)} ngày trước`;
  return formatDate(iso);
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function newIdempotencyKey(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
