import type { DishDetail, DishListResult, MatchSummary, PublicReview, RecommendationItem, ResolvedDishIngredient } from '@/types/api';
import type { Category, Difficulty, Dish, Id, RecommendationEvent } from '@/types/models';
import { filterDishes, sortDishes, type DishSort } from '@/domain/dishFilter';
import { recommend, EMPTY_STAGE_MESSAGE, type RankedDish } from '@/domain/recommendation';
import { isMealSlotSlug } from '@/domain/mealSlot';
import { normalizeText, collapseSpaces } from '@/domain/text';
import { RECOMMENDATION_SIZE } from '@/domain/constants';
import { route, type Ctx } from '../router';
import { Errors } from '../errors';
import { newId } from '../crypto';
import {
  categoryNameMap, favoriteIdsOf, ingredientMap, intParam, listParam, optionalAuth, paginate, popularityMap, ratingMap,
  requireUser, sellingInfo, str, toDishCard,
} from '../helpers';

// ---------- Danh mục, đơn vị, nguyên liệu (dữ liệu dùng chung) ----------
route('GET', '/categories', (ctx) => ({
  items: ctx.db.categories.filter((c) => c.status === 'active').sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)),
}));

route('GET', '/units', (ctx) => ({ items: ctx.db.units.filter((u) => u.status === 'active') }));

/** Tìm nguyên liệu theo tên chuẩn hoặc tên gọi khác (UC15, RR02). */
route('GET', '/ingredients', (ctx) => {
  const q = normalizeText(ctx.query.get('q') ?? '');
  const items = ctx.db.ingredients
    .filter((i) => i.status === 'active')
    .map((i) => {
      if (!q) return { i, alias: undefined as string | undefined, rank: 0 };
      if (normalizeText(i.canonicalName).includes(q)) return { i, alias: undefined, rank: normalizeText(i.canonicalName).startsWith(q) ? 3 : 2 };
      const alias = i.aliases.find((a) => normalizeText(a).includes(q));
      return alias ? { i, alias, rank: 1 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.rank - a.rank || a.i.canonicalName.localeCompare(b.i.canonicalName, 'vi'))
    .map(({ i, alias }) => ({ _id: i._id, canonicalName: i.canonicalName, aliases: i.aliases, groupId: i.groupId, avoidTags: i.avoidTags, matchedAlias: alias }));
  return { items };
});

// ---------- UC18–UC25 Danh sách, tìm kiếm, lọc, sắp xếp ----------
function slugsToIds(ctx: Ctx, type: Category['type'], slugs: string[]): Id[] {
  return slugs.map((s) => ctx.db.categories.find((c) => c.type === type && (c.slug === s || c._id === s))?._id).filter((x): x is Id => !!x);
}

route('GET', '/dishes', (ctx): DishListResult => {
  const user = optionalAuth(ctx);
  const q = ctx.query;
  const keyword = collapseSpaces(q.get('q') ?? '');
  const withIngredientIds = listParam(q, 'ingredient');
  const sort = (q.get('sort') ?? 'relevance') as DishSort;
  const ingMap = ingredientMap(ctx.db);
  const { items, needsVerification } = filterDishes(
    ctx.db.dishes,
    {
      q: keyword,
      withIngredientIds,
      mealSlotIds: slugsToIds(ctx, 'mealSlot', listParam(q, 'mealSlot')),
      dishTypeIds: slugsToIds(ctx, 'dishType', listParam(q, 'dishType')),
      cuisineIds: slugsToIds(ctx, 'cuisine', listParam(q, 'cuisine')),
      tagIds: slugsToIds(ctx, 'tag', listParam(q, 'tag')),
      difficulties: listParam(q, 'difficulty') as Difficulty[],
      tastes: listParam(q, 'taste'),
      diets: listParam(q, 'diet'),
      maxMinutes: intParam(q, 'maxMinutes'),
      excludeIngredientIds: listParam(q, 'exclude'),
    },
    ingMap,
  );
  const ratings = ratingMap(ctx.db);
  const popularity = popularityMap(ctx.db, ctx.now);
  const popularityUnavailable = sort === 'popular' && !items.some((d) => (popularity.get(d._id) ?? 0) > 0);
  const sorted = popularityUnavailable ? [] : sortDishes(items, sort, { q: keyword, rating: ratings, popularity });

  if (keyword || withIngredientIds.length) {
    const profile = user ? ctx.db.user_profiles.find((p) => p.userId === user._id) : undefined;
    ctx.db.search_events.push({
      _id: newId(), keyword: keyword || undefined, ingredientIds: withIngredientIds.length ? withIngredientIds : undefined,
      userId: profile?.saveHistory ? user!._id : undefined, createdAt: ctx.now.toISOString(),
    });
  }
  const favs = favoriteIdsOf(ctx.db, user?._id);
  const page = paginate(sorted, q);
  return { ...page, items: page.items.map((d) => toDishCard(ctx.db, d, ctx.now, { ratings, favoriteIds: favs })), needsVerification, popularityUnavailable };
});

// ---------- UC26–UC33 Chi tiết món ----------
function findPublicDish(ctx: Ctx, slugOrId: string): Dish {
  const dish = ctx.db.dishes.find((d) => d.slug === slugOrId || d._id === slugOrId);
  if (!dish || dish.status !== 'published') throw Errors.dishUnavailable();
  return dish;
}

route('GET', '/dishes/:slug', (ctx): DishDetail => {
  const user = optionalAuth(ctx);
  const dish = findPublicDish(ctx, ctx.params.slug);
  const ingMap = ingredientMap(ctx.db);
  const unitMap = new Map(ctx.db.units.map((u) => [u._id, u]));
  const catMap = new Map(ctx.db.categories.map((c) => [c._id, c]));
  const ingredients: ResolvedDishIngredient[] = dish.ingredients.map((di) => {
    const ing = ingMap.get(di.ingredientId);
    const unit = unitMap.get(di.unitId);
    return {
      ingredientId: di.ingredientId,
      name: ing?.canonicalName ?? 'Nguyên liệu chưa xác định',
      groupId: ing?.groupId,
      quantity: di.quantity,
      unit: unit ? { _id: unit._id, name: unit.name, symbol: unit.symbol } : null,
      required: di.required,
      preparationNote: di.preparationNote,
      substitutes: (ing?.substitutionIds ?? [])
        .map((id) => ingMap.get(id))
        .filter((x): x is NonNullable<typeof x> => !!x && x.status === 'active')
        .map((s) => ({ _id: s._id, name: s.canonicalName, note: ing?.substitutionNotes?.[s._id] })),
    };
  });
  const cats = (ids: Id[]) => ids.map((id) => catMap.get(id)).filter((c): c is Category => !!c && c.status === 'active');
  const ratings = ratingMap(ctx.db);
  const favs = favoriteIdsOf(ctx.db, user?._id) ?? new Set<Id>();

  // UC27: món liên quan – cùng loại/thẻ hoặc cùng nguyên liệu, chỉ món published
  const myIngs = new Set(dish.ingredients.map((i) => i.ingredientId));
  const related = ctx.db.dishes
    .filter((d) => d.status === 'published' && d._id !== dish._id)
    .map((d) => ({
      d,
      score: d.categoryIds.filter((c) => dish.categoryIds.includes(c)).length * 2 +
        d.cuisineIds.filter((c) => dish.cuisineIds.includes(c)).length +
        d.ingredients.filter((i) => i.required && myIngs.has(i.ingredientId)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.name.localeCompare(b.d.name, 'vi'))
    .slice(0, 4)
    .map((x) => toDishCard(ctx.db, x.d, ctx.now, { ratings, favoriteIds: favs }));

  const { ingredients: _i, status: _s, version: _v, ...rest } = dish;
  void _i; void _s; void _v;
  return {
    ...rest,
    ingredients,
    mealSlots: cats(dish.mealSlotIds),
    categories: cats(dish.categoryIds),
    cuisines: cats(dish.cuisineIds),
    rating: ratings.get(dish._id) ?? null,
    selling: sellingInfo(ctx.db, dish, ctx.now),
    related,
    isFavorite: favs.has(dish._id),
  };
});

/** Ghi nhận lượt mở trang chi tiết (UC41 + thống kê tổng hợp). */
route('POST', '/events/view', (ctx) => {
  const user = optionalAuth(ctx);
  const dish = findPublicDish(ctx, str(ctx.body?.dishId));
  const recId = str(ctx.body?.recommendationEventId);
  const day = ctx.now.toISOString().slice(0, 10);
  const stat = ctx.db.dish_view_stats.find((s) => s.dishId === dish._id && s.date === day);
  if (stat) stat.views++;
  else ctx.db.dish_view_stats.push({ dishId: dish._id, date: day, views: 1 });

  const rec = recId ? ctx.db.recommendation_events.find((r) => r._id === recId) : undefined;
  if (rec && rec.suggestedDishIds.includes(dish._id) && !rec.openedDishIds.includes(dish._id)) rec.openedDishIds.push(dish._id);

  let recorded = false;
  if (user) {
    const profile = ctx.db.user_profiles.find((p) => p.userId === user._id);
    if (profile?.saveHistory) {
      ctx.db.activity_events.push({
        _id: newId(), userId: user._id, eventType: 'view_dish', dishId: dish._id,
        ...(rec ? { recommendationEventId: rec._id } : {}), createdAt: ctx.now.toISOString(),
      });
      recorded = true;
    }
  }
  return { ok: true, recordedInHistory: recorded };
});

// ---------- UC39 Xem đánh giá công khai ----------
route('GET', '/dishes/:id/reviews', (ctx) => {
  const user = optionalAuth(ctx);
  const dish = findPublicDish(ctx, ctx.params.id);
  const list = ctx.db.reviews
    .filter((r) => r.dishId === dish._id && r.moderationStatus === 'published')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = paginate(list, ctx.query, 5);
  const items: PublicReview[] = page.items.map((r) => ({
    _id: r._id, dishId: r.dishId, rating: r.rating, body: r.body, createdAt: r.createdAt, updatedAt: r.updatedAt,
    authorName: ctx.db.user_profiles.find((p) => p.userId === r.userId)?.displayName ?? 'Người dùng',
    isMine: r.userId === user?._id,
  }));
  return { ...page, items };
});

// ---------- UC11–UC17 Gợi ý ----------
function toSummary(ctx: Ctx, r: RankedDish): MatchSummary | undefined {
  if (!r.match) return undefined;
  const name = (id: Id) => ctx.db.ingredients.find((i) => i._id === id)?.canonicalName ?? id;
  return {
    ratio: r.match.ratio,
    requiredTotal: r.match.requiredTotal,
    requiredHave: r.match.requiredHave,
    have: r.match.haveIds.map((id) => ({ _id: id, name: name(id) })),
    missing: r.match.missingIds.map((id) => ({ _id: id, name: name(id) })),
    optional: r.match.optionalIds.map((id) => ({ _id: id, name: name(id), have: r.match!.optionalHaveIds.includes(id) })),
  };
}

function runRecommendation(ctx: Ctx, criteria: RecommendationEvent['requestCriteria'], shown: Set<Id>, skipped: Set<Id>) {
  const user = optionalAuth(ctx);
  const profile = user ? ctx.db.user_profiles.find((p) => p.userId === user._id) ?? null : null;
  // Lịch sử/yêu thích chỉ dùng cá nhân hóa khi người dùng đồng ý (quy tắc 2.5)
  const favoriteDishIds = user ? favoriteIdsOf(ctx.db, user._id) : undefined;
  const slot = criteria.mealSlot ? ctx.db.categories.find((c) => c.type === 'mealSlot' && c.slug === criteria.mealSlot && c.status === 'active') : undefined;
  if (criteria.mode === 'meal' && !slot) throw Errors.validation({ mealSlot: 'Buổi ăn không hợp lệ.' });
  const result = recommend({
    dishes: ctx.db.dishes,
    dishesById: new Map(ctx.db.dishes.map((d) => [d._id, d])),
    ingredientById: ingredientMap(ctx.db),
    categoryName: categoryNameMap(ctx.db),
    mealSlot: slot ? { id: slot._id, name: slot.name } : undefined,
    ingredientIds: criteria.ingredientIds,
    maxMinutes: criteria.maxMinutes,
    diet: criteria.diet?.length ? criteria.diet : undefined,
    excludeIngredientIds: criteria.excludeIngredientIds,
    profile,
    favoriteDishIds,
    shownDishIds: shown,
    skippedDishIds: skipped,
    popularity: popularityMap(ctx.db, ctx.now),
  });
  return { result, slot, user, profile };
}

route('POST', '/recommendations', (ctx) => {
  const b = ctx.body ?? {};
  const mode = b.mode === 'ingredients' ? 'ingredients' : 'meal';
  const ingredientIds: Id[] = Array.isArray(b.ingredientIds) ? Array.from(new Set(b.ingredientIds.filter((x: unknown) => typeof x === 'string'))) : [];
  if (mode === 'meal' && !isMealSlotSlug(b.mealSlot)) throw Errors.validation({ mealSlot: 'Buổi ăn không hợp lệ.' });
  if (mode === 'ingredients' && ingredientIds.length === 0) throw Errors.validation({ ingredientIds: 'Vui lòng chọn ít nhất một nguyên liệu.' });
  if (ingredientIds.some((id) => !ctx.db.ingredients.some((i) => i._id === id))) throw Errors.validation({ ingredientIds: 'Có nguyên liệu không có trong danh mục.' });
  if (b.maxMinutes !== undefined && b.maxMinutes !== null && (!Number.isInteger(b.maxMinutes) || b.maxMinutes <= 0)) throw Errors.validation({ maxMinutes: 'Thời gian phải là số nguyên dương.' });

  const criteria: RecommendationEvent['requestCriteria'] = {
    mode,
    ...(mode === 'meal' ? { mealSlot: b.mealSlot } : {}),
    ...(ingredientIds.length ? { ingredientIds } : {}),
    ...(b.maxMinutes ? { maxMinutes: b.maxMinutes } : {}),
    ...(Array.isArray(b.diet) && b.diet.length ? { diet: b.diet } : {}),
    ...(Array.isArray(b.excludeIngredientIds) && b.excludeIngredientIds.length ? { excludeIngredientIds: b.excludeIngredientIds } : {}),
  };
  const { result, slot, user, profile } = runRecommendation(ctx, criteria, new Set(), new Set());
  const limit = Math.min(48, Math.max(1, Number(b.limit) || (mode === 'meal' ? RECOMMENDATION_SIZE : 24)));
  const top = result.ranked.slice(0, limit);
  const event: RecommendationEvent = {
    _id: newId(), userId: user?._id ?? null, requestCriteria: criteria, suggestedDishIds: top.map((r) => r.dish._id),
    dismissedDishIds: [], openedDishIds: [], displayStatus: 'shown', createdAt: ctx.now.toISOString(),
  };
  ctx.db.recommendation_events.push(event);
  if (mode === 'ingredients') {
    ctx.db.search_events.push({ _id: newId(), ingredientIds, userId: profile?.saveHistory ? user!._id : undefined, createdAt: ctx.now.toISOString() });
    if (user) {
      const sel = ctx.db.ingredient_selections.find((s) => s.userId === user._id);
      if (sel) Object.assign(sel, { ingredientIds, updatedAt: ctx.now.toISOString() });
      else ctx.db.ingredient_selections.push({ _id: newId(), userId: user._id, ingredientIds, updatedAt: ctx.now.toISOString() });
    }
  }
  const ratings = ratingMap(ctx.db);
  const favs = favoriteIdsOf(ctx.db, user?._id);
  const items: RecommendationItem[] = top.map((r) => ({ dish: toDishCard(ctx.db, r.dish, ctx.now, { ratings, favoriteIds: favs }), score: r.score, reasons: r.reasons, match: toSummary(ctx, r) }));
  return {
    eventId: event._id,
    mealSlot: slot,
    items,
    emptyReason: result.emptyStage ? EMPTY_STAGE_MESSAGE[result.emptyStage] : undefined,
    excludedNeedsVerification: result.excludedUnknown,
    appliedProfile: !!profile && (profile.avoidedIngredientIds.length > 0 || profile.dietCodes.length > 0),
  };
});

function ownEvent(ctx: Ctx): RecommendationEvent {
  const user = optionalAuth(ctx);
  const ev = ctx.db.recommendation_events.find((r) => r._id === ctx.params.id);
  if (!ev) throw Errors.notFound('Lượt gợi ý');
  if (ev.userId && ev.userId !== user?._id) throw Errors.forbidden();
  return ev;
}

/** UC13 Đổi món khác: ghi món bị bỏ qua, trả món phù hợp tiếp theo chưa hiển thị. */
route('POST', '/recommendations/:id/replace', (ctx) => {
  const ev = ownEvent(ctx);
  const dishId = str(ctx.body?.dishId);
  if (!ev.suggestedDishIds.includes(dishId)) throw Errors.badRequest('NOT_IN_RECOMMENDATION', 'Món không thuộc lượt gợi ý này.');
  if (!ev.dismissedDishIds.includes(dishId)) ev.dismissedDishIds.push(dishId);
  const { result, user } = runRecommendation(ctx, ev.requestCriteria, new Set(ev.suggestedDishIds), new Set(ev.dismissedDishIds));
  const next = result.ranked.find((r) => !ev.suggestedDishIds.includes(r.dish._id));
  if (!next) return { item: null, emptyReason: EMPTY_STAGE_MESSAGE.exhausted };
  ev.suggestedDishIds.push(next.dish._id);
  return {
    item: { dish: toDishCard(ctx.db, next.dish, ctx.now, { favoriteIds: favoriteIdsOf(ctx.db, user?._id) }), score: next.score, reasons: next.reasons, match: toSummary(ctx, next) },
  };
});

/** Người dùng chọn một món từ kết quả gợi ý (dùng cho thống kê UC76). */
route('POST', '/recommendations/:id/choose', (ctx) => {
  const ev = ownEvent(ctx);
  const dishId = str(ctx.body?.dishId);
  if (!ev.suggestedDishIds.includes(dishId)) throw Errors.badRequest('NOT_IN_RECOMMENDATION', 'Món không thuộc lượt gợi ý này.');
  ev.chosenDishId = dishId;
  if (!ev.openedDishIds.includes(dishId)) ev.openedDishIds.push(dishId);
  const user = ctx.user;
  if (user && ctx.db.user_profiles.find((p) => p.userId === user._id)?.saveHistory) {
    ctx.db.activity_events.push({ _id: newId(), userId: user._id, eventType: 'choose_from_recommendation', dishId, recommendationEventId: ev._id, createdAt: ctx.now.toISOString() });
  }
  return { ok: true };
});

// ---------- Danh sách nguyên liệu đang có (người dùng đã đăng nhập) ----------
route('GET', '/ingredient-selections', (ctx) => {
  const user = requireUser(ctx);
  const sel = ctx.db.ingredient_selections.find((s) => s.userId === user._id);
  return { ingredientIds: (sel?.ingredientIds ?? []).filter((id) => ctx.db.ingredients.some((i) => i._id === id && i.status === 'active')) };
});

route('PUT', '/ingredient-selections', (ctx) => {
  const user = requireUser(ctx);
  const ids: Id[] = Array.isArray(ctx.body?.ingredientIds) ? Array.from(new Set(ctx.body.ingredientIds as Id[])) : [];
  if (ids.some((id) => !ctx.db.ingredients.some((i) => i._id === id))) throw Errors.validation({ ingredientIds: 'Có nguyên liệu không hợp lệ.' });
  const sel = ctx.db.ingredient_selections.find((s) => s.userId === user._id);
  if (sel) Object.assign(sel, { ingredientIds: ids, updatedAt: ctx.now.toISOString() });
  else ctx.db.ingredient_selections.push({ _id: newId(), userId: user._id, ingredientIds: ids, updatedAt: ctx.now.toISOString() });
  return { ingredientIds: ids };
});
