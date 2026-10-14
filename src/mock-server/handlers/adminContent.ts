import type { AdminDishRow, CategoryRow, DishInput, IngredientRow, UnitRow, ValidationResult } from '@/types/api';
import type { Category, CategoryType, Dish, DishIngredient, DishStep, Ingredient, Unit } from '@/types/models';
import { validateDishForPublish, renumberSteps } from '@/domain/publishValidation';
import { DIETS, INGREDIENT_GROUPS, TASTES } from '@/domain/constants';
import { normalizeText, slugify } from '@/domain/text';
import { route, type Ctx } from '../router';
import { Errors } from '../errors';
import { newId } from '../crypto';
import { audit, paginate, pick, requireAdmin, str } from '../helpers';

// ================= Quản lý món ăn (UC53–UC56) & công thức (UC61–UC63) =================

function dishRow(ctx: Ctx, d: Dish): AdminDishRow {
  return {
    _id: d._id, slug: d.slug, name: d.name, status: d.status, mealSlotIds: d.mealSlotIds, updatedAt: d.updatedAt,
    ingredientCount: d.ingredients.length, stepCount: d.steps.length, selling: ctx.db.selling_menus.some((m) => m.dishId === d._id),
  };
}

function findDish(ctx: Ctx): Dish {
  const d = ctx.db.dishes.find((x) => x._id === ctx.params.id);
  if (!d) throw Errors.notFound('Món ăn');
  return d;
}

function publishRefs(ctx: Ctx) {
  return {
    activeMealSlotIds: new Set(ctx.db.categories.filter((c) => c.type === 'mealSlot' && c.status === 'active').map((c) => c._id)),
    ingredientIds: new Set(ctx.db.ingredients.map((i) => i._id)),
    unitIds: new Set(ctx.db.units.map((u) => u._id)),
  };
}

/** Kiểm tra dữ liệu khi lưu nháp – chỉ chặn lỗi định dạng; tính đầy đủ được kiểm khi xuất bản. */
function parseDishInput(ctx: Ctx, b: Partial<DishInput>, current?: Dish): DishInput {
  const fe: Record<string, string> = {};
  const name = str(b.name).trim();
  if (!name) fe.name = 'Vui lòng nhập tên món.';
  else if (name.length > 120) fe.name = 'Tên món tối đa 120 ký tự.';
  const slug = slugify(str(b.slug) || name);
  if (!slug) fe.slug = 'Đường dẫn không hợp lệ.';
  else if (ctx.db.dishes.some((d) => d.slug === slug && d._id !== current?._id)) fe.slug = 'Đường dẫn đã được dùng cho món khác.';
  const intField = (key: 'baseServings' | 'prepMinutes' | 'cookMinutes', min: number, label: string) => {
    const v = b[key];
    if (!Number.isInteger(v) || (v as number) < min) fe[key] = `${label} phải là số nguyên ${min > 0 ? 'dương' : '≥ 0'}.`;
    return v as number;
  };
  const baseServings = intField('baseServings', 1, 'Khẩu phần gốc');
  const prepMinutes = intField('prepMinutes', 0, 'Thời gian sơ chế');
  const cookMinutes = intField('cookMinutes', 0, 'Thời gian nấu');
  const difficulty = b.difficulty;
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') fe.difficulty = 'Vui lòng chọn độ khó.';

  const catOk = (ids: unknown, types: CategoryType[], field: string) => {
    const arr = Array.isArray(ids) ? Array.from(new Set(ids.filter((x): x is string => typeof x === 'string'))) : [];
    // Mục đã ẩn không được gắn mới (UC65); cho phép giữ mục đã gắn trước đó
    const prev = new Set(current ? [...current.mealSlotIds, ...current.categoryIds, ...current.cuisineIds] : []);
    const bad = arr.filter((id) => {
      const c = ctx.db.categories.find((x) => x._id === id);
      return !c || !types.includes(c.type) || (c.status !== 'active' && !prev.has(id));
    });
    if (bad.length) fe[field] = 'Có danh mục không hợp lệ hoặc đã bị ẩn.';
    return arr;
  };
  const mealSlotIds = catOk(b.mealSlotIds, ['mealSlot'], 'mealSlotIds');
  if (mealSlotIds.length === 0) fe.mealSlotIds = 'Chọn ít nhất một buổi ăn.';
  const categoryIds = catOk(b.categoryIds, ['dishType', 'tag'], 'categoryIds');
  const cuisineIds = catOk(b.cuisineIds, ['cuisine'], 'cuisineIds');
  const tasteTags = Array.isArray(b.tasteTags) ? b.tasteTags.filter((t) => TASTES.some((x) => x.code === t)) : [];
  const dietCodes = b.dietCodes === undefined || b.dietCodes === null ? undefined : (b.dietCodes as string[]).filter((t) => DIETS.some((x) => x.code === t));
  const images = Array.isArray(b.images) ? b.images.map((x) => str(x).trim()).filter(Boolean).slice(0, 6) : [];
  images.forEach((u, i) => { if (!/^(https?:\/\/|\/|data:image\/)/.test(u)) fe[`images.${i}`] = 'Đường dẫn ảnh không hợp lệ.'; });

  const ingredients: DishIngredient[] = Array.isArray(b.ingredients) ? b.ingredients.map((x, idx) => {
    const ing = ctx.db.ingredients.find((i) => i._id === x.ingredientId);
    const unit = ctx.db.units.find((u) => u._id === x.unitId);
    const isNew = !current?.ingredients.some((ci) => ci.ingredientId === x.ingredientId);
    if (!ing) fe[`ingredients.${idx}.ingredientId`] = 'Chọn nguyên liệu trong danh mục chuẩn.';
    else if (ing.status === 'inactive' && isNew) fe[`ingredients.${idx}.ingredientId`] = 'Nguyên liệu đã ngừng sử dụng, không thể thêm mới.';
    if (!unit) fe[`ingredients.${idx}.unitId`] = 'Chọn đơn vị tính.';
    else if (unit.status === 'inactive' && !current?.ingredients.some((ci) => ci.unitId === unit._id)) fe[`ingredients.${idx}.unitId`] = 'Đơn vị đã ngừng sử dụng.';
    if (!(typeof x.quantity === 'number' && x.quantity > 0)) fe[`ingredients.${idx}.quantity`] = 'Định lượng phải > 0.';
    return { ingredientId: x.ingredientId, quantity: x.quantity, unitId: x.unitId, required: !!x.required, ...(str(x.preparationNote).trim() ? { preparationNote: str(x.preparationNote).trim() } : {}) };
  }) : [];
  const dupIng = ingredients.findIndex((x, i) => ingredients.findIndex((y) => y.ingredientId === x.ingredientId) !== i);
  if (dupIng >= 0) fe[`ingredients.${dupIng}.ingredientId`] = 'Nguyên liệu bị trùng trong công thức.';

  const steps: DishStep[] = Array.isArray(b.steps) ? renumberSteps(b.steps.map((s, idx) => {
    if (!str(s.title).trim()) fe[`steps.${idx}.title`] = 'Bước cần có tiêu đề.';
    if (!str(s.instruction).trim()) fe[`steps.${idx}.instruction`] = 'Bước cần có nội dung hướng dẫn.';
    if (s.durationMinutes !== undefined && s.durationMinutes !== null && (!Number.isInteger(s.durationMinutes) || s.durationMinutes < 0)) fe[`steps.${idx}.durationMinutes`] = 'Thời gian phải là số nguyên ≥ 0.';
    return {
      stepNo: idx + 1, title: str(s.title).trim(), instruction: str(s.instruction).trim(),
      ...(Number.isInteger(s.durationMinutes) ? { durationMinutes: s.durationMinutes } : {}),
      ...(str(s.imageUrl).trim() ? { imageUrl: str(s.imageUrl).trim() } : {}),
      ...(str(s.note).trim() ? { note: str(s.note).trim() } : {}),
    };
  })) : [];

  if (Object.keys(fe).length) throw Errors.validation(fe);
  return {
    name, slug, description: str(b.description).trim() || undefined, images, mealSlotIds, categoryIds, cuisineIds, tasteTags, dietCodes,
    baseServings, prepMinutes, cookMinutes, difficulty: difficulty!, ingredients, steps,
    nutrition: b.nutrition ?? undefined, source: str(b.source).trim() || undefined,
  };
}

route('GET', '/admin/dishes', (ctx) => {
  requireAdmin(ctx);
  const q = normalizeText(ctx.query.get('q') ?? '');
  const status = ctx.query.get('status');
  const list = ctx.db.dishes
    .filter((d) => (!q || normalizeText(d.name).includes(q)) && (!status || d.status === status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((d) => dishRow(ctx, d));
  const counts = { draft: 0, published: 0, hidden: 0 } as Record<string, number>;
  ctx.db.dishes.forEach((d) => counts[d.status]++);
  return { ...paginate(list, ctx.query, 15), counts };
});

route('GET', '/admin/dishes/:id', (ctx) => {
  requireAdmin(ctx);
  return { dish: findDish(ctx) };
});

route('POST', '/admin/dishes', (ctx) => {
  requireAdmin(ctx);
  const input = parseDishInput(ctx, ctx.body ?? {});
  const now = ctx.now.toISOString();
  // Món mới luôn ở trạng thái draft (UC53)
  const dish: Dish = { _id: newId(), ...input, status: 'draft', version: 1, createdAt: now, updatedAt: now };
  ctx.db.dishes.push(dish);
  audit(ctx, 'dish', dish._id, 'create_dish', undefined, { name: dish.name });
  return { dish };
});

route('PATCH', '/admin/dishes/:id', (ctx) => {
  requireAdmin(ctx);
  const dish = findDish(ctx);
  // Phát hiện xung đột cập nhật (UC54)
  if (ctx.body?.version !== undefined && ctx.body.version !== dish.version) {
    throw Errors.conflict('VERSION_CONFLICT', 'Món đã được người khác cập nhật. Vui lòng tải lại bản mới trước khi lưu.');
  }
  const input = parseDishInput(ctx, ctx.body ?? {}, dish);
  const before = pick(dish, ['name', 'status', 'baseServings', 'prepMinutes', 'cookMinutes']);
  let reverted = false;
  // Sửa món đã xuất bản làm mất tính đầy đủ → không tiếp tục hiển thị công khai (6.18)
  if (dish.status === 'published' && validateDishForPublish(input, publishRefs(ctx)).length > 0) {
    dish.status = 'draft';
    reverted = true;
  }
  Object.assign(dish, input, { version: dish.version + 1, updatedAt: ctx.now.toISOString() });
  if (input.dietCodes === undefined) delete dish.dietCodes;
  audit(ctx, 'dish', dish._id, 'update_dish', before, { ...pick(dish, ['name', 'status', 'baseServings', 'prepMinutes', 'cookMinutes']) });
  return { dish, revertedToDraft: reverted };
});

route('POST', '/admin/dishes/:id/validate', (ctx): ValidationResult => {
  requireAdmin(ctx);
  const issues = validateDishForPublish(findDish(ctx), publishRefs(ctx));
  return { ok: issues.length === 0, issues };
});

route('POST', '/admin/dishes/:id/publish', (ctx) => {
  requireAdmin(ctx);
  const dish = findDish(ctx);
  if (dish.status === 'published') return { dish };
  const issues = validateDishForPublish(dish, publishRefs(ctx));
  if (issues.length) {
    const fe = Object.fromEntries(issues.map((i) => [i.field, i.message]));
    throw Errors.validation(fe, 'Món chưa đủ điều kiện xuất bản.');
  }
  const before = { status: dish.status };
  dish.status = 'published';
  dish.publishedAt = dish.publishedAt ?? ctx.now.toISOString();
  dish.version++;
  dish.updatedAt = ctx.now.toISOString();
  audit(ctx, 'dish', dish._id, 'publish_dish', before, { status: 'published' });
  return { dish };
});

route('POST', '/admin/dishes/:id/hide', (ctx) => {
  requireAdmin(ctx);
  const dish = findDish(ctx);
  const before = { status: dish.status };
  dish.status = 'hidden';
  dish.version++;
  dish.updatedAt = ctx.now.toISOString();
  // Món ẩn không còn bán được
  ctx.db.selling_menus.filter((m) => m.dishId === dish._id).forEach((m) => (m.available = false));
  audit(ctx, 'dish', dish._id, 'hide_dish', before, { status: 'hidden' }, str(ctx.body?.reason) || undefined);
  return { dish };
});

function dishReferences(ctx: Ctx, id: string) {
  return {
    orders: ctx.db.orders.filter((o) => o.items.some((i) => i.dishId === id)).length,
    reviews: ctx.db.reviews.filter((r) => r.dishId === id).length,
    favorites: ctx.db.favorites.filter((f) => f.dishId === id).length,
    history: ctx.db.activity_events.filter((e) => e.dishId === id).length,
    sellingMenus: ctx.db.selling_menus.filter((m) => m.dishId === id).length,
    carts: ctx.db.carts.filter((c) => c.items.some((i) => i.dishId === id)).length,
  };
}

route('GET', '/admin/dishes/:id/references', (ctx) => {
  requireAdmin(ctx);
  const refs = dishReferences(ctx, findDish(ctx)._id);
  return { references: refs, canDelete: Object.values(refs).every((v) => v === 0) };
});

route('DELETE', '/admin/dishes/:id', (ctx) => {
  requireAdmin(ctx);
  const dish = findDish(ctx);
  const refs = dishReferences(ctx, dish._id);
  // Món có dữ liệu tham chiếu thì chỉ được ẩn (UC56)
  if (Object.values(refs).some((v) => v > 0)) throw Errors.conflict('DISH_REFERENCED', 'Món đang được tham chiếu bởi đơn hàng, đánh giá, yêu thích hoặc lịch sử. Hãy ẩn món thay vì xóa.');
  ctx.db.dishes = ctx.db.dishes.filter((d) => d._id !== dish._id);
  audit(ctx, 'dish', dish._id, 'delete_dish', { name: dish.name, status: dish.status });
  return { ok: true };
});

// ================= Nguyên liệu (UC57, UC59, UC60) =================
function ingUsage(ctx: Ctx, id: string): number {
  return ctx.db.dishes.filter((d) => d.ingredients.some((i) => i.ingredientId === id)).length;
}

route('GET', '/admin/ingredients', (ctx) => {
  requireAdmin(ctx);
  const q = normalizeText(ctx.query.get('q') ?? '');
  const group = ctx.query.get('group');
  const status = ctx.query.get('status');
  const list: IngredientRow[] = ctx.db.ingredients
    .filter((i) => (!q || normalizeText(i.canonicalName).includes(q) || i.aliases.some((a) => normalizeText(a).includes(q))) && (!group || i.groupId === group) && (!status || i.status === status))
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'vi'))
    .map((i) => ({ ...i, usageCount: ingUsage(ctx, i._id) }));
  return paginate(list, ctx.query, 20, 500);
});

function parseIngredient(ctx: Ctx, b: Partial<Ingredient>, current?: Ingredient) {
  const fe: Record<string, string> = {};
  const name = str(b.canonicalName).trim();
  if (!name) fe.canonicalName = 'Vui lòng nhập tên chuẩn.';
  const aliases = Array.from(new Set((Array.isArray(b.aliases) ? b.aliases : []).map((a) => str(a).trim()).filter(Boolean)));
  const n = normalizeText(name);
  // Kiểm tra trùng tên chuẩn và các tên gọi tương đương (6.17)
  const clash = ctx.db.ingredients.find((i) => i._id !== current?._id && (normalizeText(i.canonicalName) === n || i.aliases.some((a) => normalizeText(a) === n)));
  if (name && clash) fe.canonicalName = `Trùng với nguyên liệu “${clash.canonicalName}”.`;
  const aliasClash = aliases.find((a) => ctx.db.ingredients.some((i) => i._id !== current?._id && normalizeText(i.canonicalName) === normalizeText(a)));
  if (aliasClash) fe.aliases = `Tên gọi “${aliasClash}” đang là tên chuẩn của nguyên liệu khác.`;
  if (!INGREDIENT_GROUPS.some((g) => g.code === b.groupId)) fe.groupId = 'Vui lòng chọn nhóm nguyên liệu hợp lệ.';
  const avoidTags = Array.from(new Set((Array.isArray(b.avoidTags) ? b.avoidTags : []).map((a) => slugify(str(a))).filter(Boolean)));
  if (Object.keys(fe).length) throw Errors.validation(fe);
  return { canonicalName: name, aliases, groupId: b.groupId!, avoidTags };
}

route('POST', '/admin/ingredients', (ctx) => {
  requireAdmin(ctx);
  const data = parseIngredient(ctx, ctx.body ?? {});
  const ing: Ingredient = { _id: newId(), ...data, substitutionIds: [], substitutionNotes: {}, status: 'active' };
  ctx.db.ingredients.push(ing);
  audit(ctx, 'ingredient', ing._id, 'create_ingredient', undefined, { canonicalName: ing.canonicalName });
  return { ingredient: ing };
});

function findIng(ctx: Ctx): Ingredient {
  const i = ctx.db.ingredients.find((x) => x._id === ctx.params.id);
  if (!i) throw Errors.notFound('Nguyên liệu');
  return i;
}

route('PATCH', '/admin/ingredients/:id', (ctx) => {
  requireAdmin(ctx);
  const ing = findIng(ctx);
  const data = parseIngredient(ctx, ctx.body ?? {}, ing);
  const before = pick(ing, ['canonicalName', 'groupId', 'aliases', 'avoidTags']);
  Object.assign(ing, data);
  audit(ctx, 'ingredient', ing._id, 'update_ingredient', before, data);
  return { ingredient: ing };
});

/** UC59 Khai báo nguyên liệu thay thế. */
route('PUT', '/admin/ingredients/:id/substitutions', (ctx) => {
  requireAdmin(ctx);
  const ing = findIng(ctx);
  const list: { ingredientId: string; note?: string }[] = Array.isArray(ctx.body?.items) ? ctx.body.items : [];
  const ids = list.map((x) => x.ingredientId);
  if (ids.includes(ing._id)) throw Errors.validation({ items: 'Một nguyên liệu không được thay thế cho chính nó.' });
  if (new Set(ids).size !== ids.length) throw Errors.validation({ items: 'Danh sách thay thế bị trùng.' });
  if (ids.some((id) => !ctx.db.ingredients.some((i) => i._id === id))) throw Errors.validation({ items: 'Có nguyên liệu thay thế không tồn tại.' });
  const before = { substitutionIds: ing.substitutionIds };
  ing.substitutionIds = ids;
  ing.substitutionNotes = Object.fromEntries(list.filter((x) => str(x.note).trim()).map((x) => [x.ingredientId, str(x.note).trim()]));
  audit(ctx, 'ingredient', ing._id, 'update_substitutions', before, { substitutionIds: ids });
  return { ingredient: ing };
});

route('POST', '/admin/ingredients/:id/status', (ctx) => {
  requireAdmin(ctx);
  const ing = findIng(ctx);
  const status = ctx.body?.status === 'inactive' ? 'inactive' : 'active';
  audit(ctx, 'ingredient', ing._id, status === 'inactive' ? 'deactivate_ingredient' : 'activate_ingredient', { status: ing.status }, { status });
  ing.status = status;
  return { ingredient: ing };
});

route('DELETE', '/admin/ingredients/:id', (ctx) => {
  requireAdmin(ctx);
  const ing = findIng(ctx);
  const used = ingUsage(ctx, ing._id);
  const usedAsSub = ctx.db.ingredients.some((i) => i.substitutionIds.includes(ing._id));
  const usedInProfiles = ctx.db.user_profiles.some((p) => p.avoidedIngredientIds.includes(ing._id));
  // Không xóa cứng nguyên liệu đang được tham chiếu (UC60)
  if (used || usedAsSub || usedInProfiles) throw Errors.conflict('INGREDIENT_REFERENCED', `Nguyên liệu đang được dùng (${used} công thức${usedAsSub ? ', danh sách thay thế' : ''}${usedInProfiles ? ', hồ sơ người dùng' : ''}). Hãy chuyển sang ngừng sử dụng.`);
  ctx.db.ingredients = ctx.db.ingredients.filter((i) => i._id !== ing._id);
  audit(ctx, 'ingredient', ing._id, 'delete_ingredient', { canonicalName: ing.canonicalName });
  return { ok: true };
});

// ================= Đơn vị tính (UC58) =================
const unitUsage = (ctx: Ctx, id: string) => ctx.db.dishes.filter((d) => d.ingredients.some((i) => i.unitId === id)).length;

route('GET', '/admin/units', (ctx) => {
  requireAdmin(ctx);
  const items: UnitRow[] = ctx.db.units.map((u) => ({ ...u, usageCount: unitUsage(ctx, u._id) }));
  return { items };
});

function parseUnit(ctx: Ctx, b: Partial<Unit>, current?: Unit) {
  const name = str(b.name).trim();
  const symbol = str(b.symbol).trim();
  const fe: Record<string, string> = {};
  if (!name) fe.name = 'Vui lòng nhập tên đơn vị.';
  if (!symbol) fe.symbol = 'Vui lòng nhập ký hiệu.';
  if (name && ctx.db.units.some((u) => u._id !== current?._id && normalizeText(u.name) === normalizeText(name))) fe.name = 'Tên đơn vị đã tồn tại.';
  if (symbol && ctx.db.units.some((u) => u._id !== current?._id && u.symbol.toLowerCase() === symbol.toLowerCase())) fe.symbol = 'Ký hiệu đã tồn tại.';
  if (Object.keys(fe).length) throw Errors.validation(fe);
  return { name, symbol };
}

route('POST', '/admin/units', (ctx) => {
  requireAdmin(ctx);
  const data = parseUnit(ctx, ctx.body ?? {});
  const now = ctx.now.toISOString();
  const unit: Unit = { _id: newId(), ...data, status: 'active', createdAt: now, updatedAt: now };
  ctx.db.units.push(unit);
  audit(ctx, 'unit', unit._id, 'create_unit', undefined, data);
  return { unit };
});

route('PATCH', '/admin/units/:id', (ctx) => {
  requireAdmin(ctx);
  const unit = ctx.db.units.find((u) => u._id === ctx.params.id);
  if (!unit) throw Errors.notFound('Đơn vị');
  const before = pick(unit, ['name', 'symbol', 'status']);
  if ('status' in (ctx.body ?? {}) && Object.keys(ctx.body).length === 1) {
    unit.status = ctx.body.status === 'inactive' ? 'inactive' : 'active';
  } else {
    Object.assign(unit, parseUnit(ctx, ctx.body ?? {}, unit));
  }
  unit.updatedAt = ctx.now.toISOString();
  audit(ctx, 'unit', unit._id, 'update_unit', before, pick(unit, ['name', 'symbol', 'status']));
  return { unit };
});

route('DELETE', '/admin/units/:id', (ctx) => {
  requireAdmin(ctx);
  const unit = ctx.db.units.find((u) => u._id === ctx.params.id);
  if (!unit) throw Errors.notFound('Đơn vị');
  if (unitUsage(ctx, unit._id) > 0) throw Errors.conflict('UNIT_REFERENCED', 'Đơn vị đang được công thức sử dụng nên không thể xóa. Hãy chuyển sang ngừng sử dụng.');
  ctx.db.units = ctx.db.units.filter((u) => u._id !== unit._id);
  audit(ctx, 'unit', unit._id, 'delete_unit', pick(unit, ['name', 'symbol']));
  return { ok: true };
});

// ================= Danh mục (UC64–UC66) =================
const catUsage = (ctx: Ctx, id: string) => ctx.db.dishes.filter((d) => d.mealSlotIds.includes(id) || d.categoryIds.includes(id) || d.cuisineIds.includes(id)).length;

route('GET', '/admin/categories', (ctx) => {
  requireAdmin(ctx);
  const type = ctx.query.get('type');
  const items: CategoryRow[] = ctx.db.categories
    .filter((c) => !type || c.type === type)
    .sort((a, b) => a.type.localeCompare(b.type) || (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
    .map((c) => ({ ...c, usageCount: catUsage(ctx, c._id) }));
  return { items };
});

function parseCategory(ctx: Ctx, b: Partial<Category>, current?: Category) {
  const fe: Record<string, string> = {};
  const type = (current?.type ?? b.type) as CategoryType;
  if (!['mealSlot', 'dishType', 'cuisine', 'tag'].includes(type)) fe.type = 'Loại danh mục không hợp lệ.';
  const name = str(b.name).trim();
  if (!name) fe.name = 'Vui lòng nhập tên.';
  const slug = slugify(str(b.slug) || name);
  // Cặp (type, slug) duy nhất; tên chuẩn hóa không trùng trong cùng loại
  if (ctx.db.categories.some((c) => c._id !== current?._id && c.type === type && (c.slug === slug || normalizeText(c.name) === normalizeText(name)))) fe.name = 'Đã có danh mục trùng tên hoặc mã trong cùng loại.';
  const displayOrder = b.displayOrder === undefined || b.displayOrder === null ? undefined : Number(b.displayOrder);
  if (displayOrder !== undefined && !Number.isInteger(displayOrder)) fe.displayOrder = 'Thứ tự phải là số nguyên.';
  if (Object.keys(fe).length) throw Errors.validation(fe);
  return { type, name, slug, displayOrder };
}

route('POST', '/admin/categories', (ctx) => {
  requireAdmin(ctx);
  const data = parseCategory(ctx, ctx.body ?? {});
  const now = ctx.now.toISOString();
  const cat: Category = { _id: newId(), ...data, status: 'active', createdAt: now, updatedAt: now };
  ctx.db.categories.push(cat);
  audit(ctx, 'category', cat._id, 'create_category', undefined, data);
  return { category: cat };
});

route('PATCH', '/admin/categories/:id', (ctx) => {
  requireAdmin(ctx);
  const cat = ctx.db.categories.find((c) => c._id === ctx.params.id);
  if (!cat) throw Errors.notFound('Danh mục');
  const before = pick(cat, ['name', 'slug', 'status', 'displayOrder']);
  if (ctx.body?.status && Object.keys(ctx.body).length === 1) {
    const status = ctx.body.status === 'hidden' ? 'hidden' : 'active';
    // Không cho ẩn buổi ăn cuối cùng còn hoạt động
    if (status === 'hidden' && cat.type === 'mealSlot' && ctx.db.categories.filter((c) => c.type === 'mealSlot' && c.status === 'active').length <= 1) {
      throw Errors.conflict('LAST_MEAL_SLOT', 'Phải còn ít nhất một buổi ăn đang hoạt động.');
    }
    cat.status = status;
  } else {
    Object.assign(cat, parseCategory(ctx, ctx.body ?? {}, cat));
  }
  cat.updatedAt = ctx.now.toISOString();
  audit(ctx, 'category', cat._id, cat.status !== before.status ? (cat.status === 'hidden' ? 'hide_category' : 'show_category') : 'update_category', before, pick(cat, ['name', 'slug', 'status', 'displayOrder']));
  return { category: cat, affectedDishes: catUsage(ctx, cat._id) };
});
