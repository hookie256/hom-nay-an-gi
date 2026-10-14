import type { DishIngredient, Id } from '@/types/models';

export interface MatchResult {
  /** B – số nguyên liệu bắt buộc */
  requiredTotal: number;
  /** C – số nguyên liệu bắt buộc người dùng đã có */
  requiredHave: number;
  /** C / B (0..1); null khi công thức không có nguyên liệu bắt buộc (cần xác minh) */
  ratio: number | null;
  haveIds: Id[];
  missingIds: Id[];
  /** Nguyên liệu tùy chọn – hiển thị riêng, không làm giảm tỷ lệ */
  optionalIds: Id[];
  optionalHaveIds: Id[];
}

/**
 * Tính mức độ khớp nguyên liệu theo mục 5.11:
 *   Mức độ khớp = C / B × 100%, Số còn thiếu = B − C.
 * Nguyên liệu chọn trùng chỉ tính một lần; chỉ xét nguyên liệu bắt buộc.
 */
export function computeIngredientMatch(dishIngredients: DishIngredient[], selectedIds: Iterable<Id>): MatchResult {
  const selected = new Set(selectedIds);
  const requiredIds = unique(dishIngredients.filter((i) => i.required).map((i) => i.ingredientId));
  const optionalIds = unique(dishIngredients.filter((i) => !i.required).map((i) => i.ingredientId)).filter(
    (id) => !requiredIds.includes(id),
  );
  const haveIds = requiredIds.filter((id) => selected.has(id));
  const missingIds = requiredIds.filter((id) => !selected.has(id));
  return {
    requiredTotal: requiredIds.length,
    requiredHave: haveIds.length,
    ratio: requiredIds.length === 0 ? null : haveIds.length / requiredIds.length,
    haveIds,
    missingIds,
    optionalIds,
    optionalHaveIds: optionalIds.filter((id) => selected.has(id)),
  };
}

/** Sắp xếp: tỷ lệ giảm dần, cùng tỷ lệ thì thiếu ít hơn đứng trước. */
export function compareMatch(a: MatchResult, b: MatchResult): number {
  const ra = a.ratio ?? -1;
  const rb = b.ratio ?? -1;
  if (rb !== ra) return rb - ra;
  return a.missingIds.length - b.missingIds.length;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
