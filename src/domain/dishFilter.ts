import type { Difficulty, Dish, Id, Ingredient } from '@/types/models';
import { checkAvoid, checkDiet, totalMinutes } from './recommendation';
import { normalizeText } from './text';

export type DishSort = 'relevance' | 'rating' | 'time' | 'newest' | 'popular';

export interface DishFilterCriteria {
  q?: string;
  /** Tìm món có dùng TẤT CẢ nguyên liệu này (UC20) */
  withIngredientIds?: Id[];
  mealSlotIds?: Id[];
  dishTypeIds?: Id[];
  cuisineIds?: Id[];
  tagIds?: Id[];
  difficulties?: Difficulty[];
  tastes?: string[];
  diets?: string[];
  maxMinutes?: number;
  excludeIngredientIds?: Id[];
}

/**
 * Bộ lọc danh sách món (UC19–UC25, mục 6.6):
 *  - Chỉ món published.
 *  - Các nhóm điều kiện kết hợp AND; nhiều lựa chọn trong cùng nhóm = OR.
 *  - Loại trừ nguyên liệu dùng cùng quy tắc với gợi ý; món thiếu dữ liệu thành phần bị loại và được đếm
 *    vào `needsVerification`.
 */
export function filterDishes(dishes: Dish[], c: DishFilterCriteria, ingredientById: Map<Id, Ingredient>): { items: Dish[]; needsVerification: number } {
  const q = c.q ? normalizeText(c.q) : '';
  const avoid = new Set(c.excludeIngredientIds ?? []);
  let needsVerification = 0;
  const anyOf = (values: Id[], wanted?: Id[]) => !wanted?.length || wanted.some((w) => values.includes(w));

  const items = dishes.filter((d) => {
    if (d.status !== 'published') return false;
    if (q && !normalizeText(d.name).includes(q)) return false;
    if (c.withIngredientIds?.length && !c.withIngredientIds.every((id) => d.ingredients.some((i) => i.ingredientId === id))) return false;
    if (!anyOf(d.mealSlotIds, c.mealSlotIds)) return false;
    if (!anyOf(d.categoryIds, c.dishTypeIds)) return false;
    if (!anyOf(d.categoryIds, c.tagIds)) return false;
    if (!anyOf(d.cuisineIds, c.cuisineIds)) return false;
    if (c.difficulties?.length && !c.difficulties.includes(d.difficulty)) return false;
    if (c.tastes?.length && !c.tastes.some((t) => d.tasteTags.includes(t))) return false;
    if (c.maxMinutes && totalMinutes(d) > c.maxMinutes) return false;
    if (c.diets?.length && checkDiet(d, c.diets) !== 'ok') return false;
    const av = checkAvoid(d, avoid, ingredientById);
    if (av === 'unknown') needsVerification++;
    return av === 'ok';
  });
  return { items, needsVerification };
}

export interface SortContext {
  q?: string;
  rating: Map<Id, { avg: number; count: number } | undefined>;
  popularity: Map<Id, number>;
}

/** Sắp xếp; món thiếu giá trị của tiêu chí được đặt cuối danh sách (UC22). */
export function sortDishes(items: Dish[], sort: DishSort, ctx: SortContext): Dish[] {
  const byName = (a: Dish, b: Dish) => a.name.localeCompare(b.name, 'vi');
  const arr = [...items];
  const nullsLast = (va: number | undefined, vb: number | undefined, desc: boolean) => {
    if (va === undefined && vb === undefined) return 0;
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    return desc ? vb - va : va - vb;
  };
  switch (sort) {
    case 'rating':
      return arr.sort((a, b) => nullsLast(ctx.rating.get(a._id)?.avg, ctx.rating.get(b._id)?.avg, true) || byName(a, b));
    case 'time':
      return arr.sort((a, b) => totalMinutes(a) - totalMinutes(b) || byName(a, b));
    case 'newest':
      return arr.sort((a, b) => nullsLast(a.publishedAt ? Date.parse(a.publishedAt) : undefined, b.publishedAt ? Date.parse(b.publishedAt) : undefined, true) || byName(a, b));
    case 'popular':
      return arr.sort((a, b) => nullsLast(ctx.popularity.get(a._id) || undefined, ctx.popularity.get(b._id) || undefined, true) || byName(a, b));
    case 'relevance':
    default: {
      const q = ctx.q ? normalizeText(ctx.q) : '';
      const rel = (d: Dish) => (!q ? 0 : normalizeText(d.name).startsWith(q) ? 2 : 1);
      return arr.sort((a, b) => rel(b) - rel(a) || (ctx.popularity.get(b._id) ?? 0) - (ctx.popularity.get(a._id) ?? 0) || byName(a, b));
    }
  }
}
