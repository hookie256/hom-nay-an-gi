import type { Dish, Id, Ingredient, UserProfile } from '@/types/models';
import { DIETS, RECOMMENDATION_WEIGHTS, TASTES } from './constants';
import { computeIngredientMatch, type MatchResult } from './ingredientMatch';

/** Kết quả kiểm tra nguyên liệu cần tránh của một món. */
export type AvoidCheck = 'ok' | 'contains' | 'unknown';

/**
 * Món chứa nguyên liệu cần tránh → 'contains'. Món thiếu dữ liệu thành phần (không có nguyên liệu
 * hoặc tham chiếu nguyên liệu không tồn tại) → 'unknown', không được xem là phù hợp (UC09, UC24).
 */
export function checkAvoid(dish: Dish, avoid: Set<Id>, ingredientById: Map<Id, Ingredient>): AvoidCheck {
  if (avoid.size === 0) return 'ok';
  if (!isIngredientDataComplete(dish, ingredientById)) return 'unknown';
  return dish.ingredients.some((i) => avoid.has(i.ingredientId)) ? 'contains' : 'ok';
}

export function isIngredientDataComplete(dish: Dish, ingredientById: Map<Id, Ingredient>): boolean {
  return dish.ingredients.length > 0 && dish.ingredients.every((i) => ingredientById.has(i.ingredientId));
}

/**
 * Chế độ ăn: nhiều lựa chọn trong cùng nhóm = “thỏa ít nhất một” (6.6).
 * Món chưa khai báo dietCodes → 'unknown' (không đủ dữ liệu, không coi là phù hợp).
 */
export function checkDiet(dish: Dish, diets: string[]): AvoidCheck {
  if (diets.length === 0) return 'ok';
  if (!dish.dietCodes) return 'unknown';
  return diets.some((d) => dish.dietCodes!.includes(d)) ? 'ok' : 'contains';
}

export const totalMinutes = (d: Pick<Dish, 'prepMinutes' | 'cookMinutes'>) => d.prepMinutes + d.cookMinutes;

export interface RecommendInput {
  dishes: Dish[];
  ingredientById: Map<Id, Ingredient>;
  categoryName: Map<Id, string>;
  /** Buổi ăn đã chọn (id + tên), bắt buộc ở chế độ gợi ý theo buổi */
  mealSlot?: { id: Id; name: string };
  /** Nguyên liệu đang có (chế độ gợi ý theo nguyên liệu) */
  ingredientIds?: Id[];
  /** Giới hạn thời gian rõ ràng do người dùng chọn → điều kiện lọc */
  maxMinutes?: number;
  diet?: string[];
  excludeIngredientIds?: Id[];
  profile?: UserProfile | null;
  favoriteDishIds?: Set<Id>;
  /** Món đã hiển thị trong lượt hiện tại → giảm ưu tiên */
  shownDishIds?: Set<Id>;
  /** Món người dùng vừa bỏ qua → không xuất hiện lại trong cùng lượt */
  skippedDishIds?: Set<Id>;
  popularity?: Map<Id, number>;
  dishesById?: Map<Id, Dish>;
}

export interface ScoreComponents {
  ingredients?: number;
  time?: number;
  preference?: number;
  diversity: number;
}

export interface RankedDish {
  dish: Dish;
  score: number;
  components: ScoreComponents;
  reasons: string[];
  match?: MatchResult;
}

export type EmptyStage = 'meal' | 'time' | 'diet' | 'avoid' | 'ingredients' | 'exhausted';

export const EMPTY_STAGE_MESSAGE: Record<EmptyStage, string> = {
  meal: 'Chưa có món nào được xuất bản cho buổi ăn này. Hãy thử chọn buổi khác.',
  time: 'Không có món nào hoàn thành trong giới hạn thời gian đã chọn. Hãy tăng thời gian cho phép.',
  diet: 'Không có món đã khai báo phù hợp với chế độ ăn đã chọn. Hãy bỏ bớt điều kiện chế độ ăn.',
  avoid: 'Sau khi loại các món chứa nguyên liệu cần tránh, không còn món phù hợp. Danh sách nguyên liệu cần tránh vẫn được giữ nguyên; hãy thử đổi buổi ăn hoặc điều kiện khác.',
  ingredients: 'Không có món nào dùng các nguyên liệu bạn đã chọn. Hãy thêm hoặc đổi nguyên liệu.',
  exhausted: 'Đã hết món phù hợp với điều kiện hiện tại. Hãy đổi buổi ăn hoặc điều chỉnh điều kiện.',
};

/**
 * Thuật toán gợi ý “lọc trước, xếp hạng sau” (mục 5.10).
 * Trả về danh sách đã xếp hạng (chưa cắt trang) và giai đoạn khiến kết quả rỗng (nếu có).
 */
export function recommend(input: RecommendInput): { ranked: RankedDish[]; emptyStage?: EmptyStage; excludedUnknown: number } {
  const profile = input.profile ?? null;
  const avoid = new Set<Id>([...(profile?.avoidedIngredientIds ?? []), ...(input.excludeIngredientIds ?? [])]);
  const diets = input.diet ?? profile?.dietCodes ?? [];
  const selected = input.ingredientIds ?? [];
  const skipped = input.skippedDishIds ?? new Set<Id>();
  const shown = input.shownDishIds ?? new Set<Id>();

  // ---- Bước lọc ----
  let pool = input.dishes.filter((d) => d.status === 'published');
  if (input.mealSlot) pool = pool.filter((d) => d.mealSlotIds.includes(input.mealSlot!.id));
  if (pool.length === 0) return { ranked: [], emptyStage: input.mealSlot ? 'meal' : 'ingredients', excludedUnknown: 0 };

  if (input.maxMinutes && input.maxMinutes > 0) {
    pool = pool.filter((d) => totalMinutes(d) <= input.maxMinutes!);
    if (pool.length === 0) return { ranked: [], emptyStage: 'time', excludedUnknown: 0 };
  }
  pool = pool.filter((d) => checkDiet(d, diets) === 'ok');
  if (pool.length === 0) return { ranked: [], emptyStage: 'diet', excludedUnknown: 0 };

  let excludedUnknown = 0;
  pool = pool.filter((d) => {
    const c = checkAvoid(d, avoid, input.ingredientById);
    if (c === 'unknown') excludedUnknown++;
    return c === 'ok';
  });
  if (pool.length === 0) return { ranked: [], emptyStage: 'avoid', excludedUnknown };

  const matches = new Map<Id, MatchResult>();
  if (selected.length > 0) {
    pool = pool.filter((d) => {
      if (!isIngredientDataComplete(d, input.ingredientById)) return false;
      const m = computeIngredientMatch(d.ingredients, selected);
      matches.set(d._id, m);
      return m.ratio !== null && (m.requiredHave > 0 || m.optionalHaveIds.length > 0);
    });
    if (pool.length === 0) return { ranked: [], emptyStage: 'ingredients', excludedUnknown };
  }

  pool = pool.filter((d) => !skipped.has(d._id));
  if (pool.length === 0) return { ranked: [], emptyStage: 'exhausted', excludedUnknown };

  // ---- Bước tính điểm ----
  const targetMinutes = input.maxMinutes ?? profile?.preferredCookMinutes;
  const prefSignals = preferenceSignals(profile, input.favoriteDishIds);
  const favCategoryIds = new Set<Id>();
  if (input.favoriteDishIds && input.dishesById) {
    input.favoriteDishIds.forEach((id) => input.dishesById!.get(id)?.categoryIds.forEach((c) => favCategoryIds.add(c)));
  }

  const ranked: RankedDish[] = pool.map((dish) => {
    const components: ScoreComponents = { diversity: shown.has(dish._id) ? 0.2 : 1 };
    const reasons: string[] = [];
    const total = totalMinutes(dish);

    if (input.mealSlot) reasons.push(`Phù hợp ${input.mealSlot.name.toLowerCase()}`);

    const match = matches.get(dish._id);
    if (match) {
      components.ingredients = match.ratio ?? 0;
      reasons.push(`Đã có ${match.requiredHave}/${match.requiredTotal} nguyên liệu bắt buộc`);
    }

    if (targetMinutes && targetMinutes > 0) {
      components.time = total <= targetMinutes ? 1 : Math.max(0, 1 - (total - targetMinutes) / targetMinutes);
      if (total <= targetMinutes) reasons.push(`Hoàn thành trong khoảng ${total} phút, trong giới hạn ${targetMinutes} phút đã chọn`);
      else reasons.push(`Cần khoảng ${total} phút, lâu hơn ${targetMinutes} phút mong muốn`);
    } else {
      reasons.push(`Thời gian chế biến khoảng ${total} phút`);
    }

    if (prefSignals.any) {
      const hits: boolean[] = [];
      if (prefSignals.tastes.size) {
        const t = dish.tasteTags.filter((x) => prefSignals.tastes.has(x));
        hits.push(t.length > 0);
        if (t.length) reasons.push(`Hợp khẩu vị ${t.map(tasteLabel).join(', ').toLowerCase()} bạn đã chọn`);
      }
      if (prefSignals.categories.size) {
        const c = dish.categoryIds.filter((x) => prefSignals.categories.has(x));
        hits.push(c.length > 0);
        if (c.length) reasons.push(`Thuộc loại món bạn yêu thích: ${c.map((x) => input.categoryName.get(x) ?? '').filter(Boolean).join(', ')}`);
      }
      if (prefSignals.cuisines.size) {
        const c = dish.cuisineIds.filter((x) => prefSignals.cuisines.has(x));
        hits.push(c.length > 0);
        if (c.length) reasons.push(`Thuộc ẩm thực bạn yêu thích: ${c.map((x) => input.categoryName.get(x) ?? '').filter(Boolean).join(', ')}`);
      }
      if (prefSignals.favorites) {
        const similar = input.favoriteDishIds!.has(dish._id) || dish.categoryIds.some((c) => favCategoryIds.has(c));
        hits.push(similar);
        if (input.favoriteDishIds!.has(dish._id)) reasons.push('Món bạn đã lưu yêu thích');
        else if (similar) reasons.push('Cùng loại với món bạn đã lưu');
      }
      components.preference = hits.length ? hits.filter(Boolean).length / hits.length : 0;
    }

    if (avoid.size > 0) reasons.push('Không chứa nguyên liệu bạn cần tránh');
    if (diets.length > 0) {
      const ok = diets.filter((d) => dish.dietCodes?.includes(d)).map(dietLabel);
      if (ok.length) reasons.push(`Phù hợp chế độ ${ok.join(', ').toLowerCase()}`);
    }

    return { dish, components, reasons, match, score: weightedScore(components) };
  });

  const pop = input.popularity ?? new Map<Id, number>();
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (a.match && b.match ? a.match.missingIds.length - b.match.missingIds.length : 0) ||
      (pop.get(b.dish._id) ?? 0) - (pop.get(a.dish._id) ?? 0) ||
      completeness(b.dish) - completeness(a.dish) ||
      a.dish.name.localeCompare(b.dish.name, 'vi'),
  );
  return { ranked, excludedUnknown };
}

/** Tổng điểm có trọng số; tự phân bổ lại trọng số cho các tín hiệu có dữ liệu. */
export function weightedScore(c: ScoreComponents): number {
  const parts: [number, number][] = [[RECOMMENDATION_WEIGHTS.diversity, c.diversity]];
  if (c.ingredients !== undefined) parts.push([RECOMMENDATION_WEIGHTS.ingredients, c.ingredients]);
  if (c.time !== undefined) parts.push([RECOMMENDATION_WEIGHTS.time, c.time]);
  if (c.preference !== undefined) parts.push([RECOMMENDATION_WEIGHTS.preference, c.preference]);
  const totalWeight = parts.reduce((s, [w]) => s + w, 0);
  return Math.round((parts.reduce((s, [w, v]) => s + w * v, 0) / totalWeight) * 1000) / 1000;
}

function preferenceSignals(profile: UserProfile | null, favorites?: Set<Id>) {
  const tastes = new Set(profile?.tastes ?? []);
  const categories = new Set(profile?.favoriteCategoryIds ?? []);
  const cuisines = new Set(profile?.cuisineIds ?? []);
  const fav = !!favorites && favorites.size > 0;
  return { tastes, categories, cuisines, favorites: fav, any: tastes.size + categories.size + cuisines.size > 0 || fav };
}

function completeness(d: Dish): number {
  return (d.description ? 1 : 0) + (d.images.length ? 1 : 0) + (d.nutrition ? 1 : 0) + Math.min(d.steps.length, 5) / 5;
}

const tasteLabel = (code: string) => TASTES.find((t) => t.code === code)?.label ?? code;
const dietLabel = (code: string) => DIETS.find((t) => t.code === code)?.label ?? code;
