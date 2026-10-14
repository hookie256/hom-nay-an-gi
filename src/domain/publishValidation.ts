import type { Dish, Id } from '@/types/models';

export interface FieldIssue {
  field: string;
  message: string;
}

export interface PublishRefs {
  activeMealSlotIds: Set<Id>;
  ingredientIds: Set<Id>;
  unitIds: Set<Id>;
}

/**
 * Kiểm tra công thức trước khi xuất bản (UC63, mục 5.4.1, 6.16, 6.18).
 * Món phải có: tên, ≥1 buổi ăn hợp lệ, khẩu phần gốc nguyên dương, thời gian hợp lệ,
 * ≥1 nguyên liệu bắt buộc có định lượng/đơn vị hợp lệ, ≥1 bước có nội dung, số thứ tự bước không trùng.
 */
export function validateDishForPublish(dish: Pick<Dish, 'name' | 'mealSlotIds' | 'baseServings' | 'prepMinutes' | 'cookMinutes' | 'ingredients' | 'steps'>, refs: PublishRefs): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!dish.name?.trim()) issues.push({ field: 'name', message: 'Chưa có tên món.' });
  if (!dish.mealSlotIds?.length) issues.push({ field: 'mealSlotIds', message: 'Chưa chọn buổi ăn.' });
  else if (!dish.mealSlotIds.some((id) => refs.activeMealSlotIds.has(id)))
    issues.push({ field: 'mealSlotIds', message: 'Buổi ăn đã chọn không còn hợp lệ, cần chọn buổi khác.' });
  if (!Number.isInteger(dish.baseServings) || dish.baseServings <= 0)
    issues.push({ field: 'baseServings', message: 'Khẩu phần gốc phải là số nguyên dương.' });
  if (!Number.isInteger(dish.prepMinutes) || dish.prepMinutes < 0)
    issues.push({ field: 'prepMinutes', message: 'Thời gian sơ chế phải là số nguyên ≥ 0.' });
  if (!Number.isInteger(dish.cookMinutes) || dish.cookMinutes < 0)
    issues.push({ field: 'cookMinutes', message: 'Thời gian nấu phải là số nguyên ≥ 0.' });

  const ingredients = dish.ingredients ?? [];
  if (!ingredients.some((i) => i.required)) issues.push({ field: 'ingredients', message: 'Chưa có nguyên liệu bắt buộc.' });
  const seen = new Set<Id>();
  ingredients.forEach((ing, idx) => {
    const label = `Nguyên liệu #${idx + 1}`;
    if (!refs.ingredientIds.has(ing.ingredientId)) issues.push({ field: `ingredients.${idx}.ingredientId`, message: `${label}: nguyên liệu không tồn tại.` });
    if (seen.has(ing.ingredientId)) issues.push({ field: `ingredients.${idx}.ingredientId`, message: `${label}: bị trùng trong công thức.` });
    seen.add(ing.ingredientId);
    if (!(typeof ing.quantity === 'number' && ing.quantity > 0)) issues.push({ field: `ingredients.${idx}.quantity`, message: `${label}: định lượng phải > 0.` });
    if (!refs.unitIds.has(ing.unitId)) issues.push({ field: `ingredients.${idx}.unitId`, message: `${label}: đơn vị không hợp lệ.` });
  });

  const steps = dish.steps ?? [];
  if (steps.length === 0) issues.push({ field: 'steps', message: 'Chưa có bước chế biến.' });
  const stepNos = new Set<number>();
  steps.forEach((s, idx) => {
    const label = `Bước ${idx + 1}`;
    if (!s.title?.trim()) issues.push({ field: `steps.${idx}.title`, message: `${label}: thiếu tiêu đề.` });
    if (!s.instruction?.trim()) issues.push({ field: `steps.${idx}.instruction`, message: `${label}: thiếu nội dung hướng dẫn.` });
    if (stepNos.has(s.stepNo)) issues.push({ field: `steps.${idx}.stepNo`, message: `${label}: số thứ tự bị trùng.` });
    stepNos.add(s.stepNo);
    if (s.durationMinutes !== undefined && (!Number.isInteger(s.durationMinutes) || s.durationMinutes < 0))
      issues.push({ field: `steps.${idx}.durationMinutes`, message: `${label}: thời gian phải là số nguyên ≥ 0.` });
  });
  return issues;
}

/** Đánh lại số thứ tự 1..n sau khi sắp xếp (6.18). */
export function renumberSteps<T extends { stepNo: number }>(steps: T[]): T[] {
  return steps.map((s, i) => ({ ...s, stepNo: i + 1 }));
}
