/** Đơn vị đếm được – làm tròn tới 0,5 cho dễ đọc. */
const COUNT_UNITS = new Set(['quả', 'củ', 'tép', 'lát', 'miếng', 'cây', 'bó', 'nắm', 'tai', 'con', 'gói', 'chiếc', 'lá', 'nhánh', 'trái']);
/** Đơn vị đo bằng thìa/chén – làm tròn tới 0,25. */
const SPOON_UNITS = new Set(['thìa canh', 'thìa cà phê', 'chén', 'bát', 'cốc', 'muỗng canh', 'muỗng cà phê', 'tbsp', 'tsp']);

/**
 * Tính lại định lượng theo số khẩu phần (UC30). Không thay đổi công thức gốc.
 * Ví dụ: công thức 2 khẩu phần, chọn 4 khẩu phần → nhân đôi.
 */
export function scaleQuantity(quantity: number, baseServings: number, targetServings: number, unitSymbol: string): number {
  if (!(baseServings > 0) || !(targetServings > 0)) throw new RangeError('Số khẩu phần phải là số dương');
  const raw = (quantity * targetServings) / baseServings;
  return roundForUnit(raw, unitSymbol);
}

export function roundForUnit(value: number, unitSymbol: string): number {
  const u = unitSymbol.trim().toLowerCase();
  if (COUNT_UNITS.has(u)) return Math.max(0.5, Math.round(value * 2) / 2);
  if (SPOON_UNITS.has(u)) return Math.max(0.25, Math.round(value * 4) / 4);
  if (u === 'g' || u === 'ml') {
    if (value >= 100) return Math.round(value / 5) * 5;
    if (value >= 10) return Math.round(value);
    return Math.round(value * 10) / 10;
  }
  return Math.round(value * 100) / 100;
}

/** Định dạng số lượng theo kiểu Việt Nam: 1,5 / ½ / ¼ */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 100) / 100;
  const fracMap: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
  if (fracMap[frac]) return whole > 0 ? `${whole}${fracMap[frac]}` : fracMap[frac];
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}
