import { MEAL_SLOT_HOURS, MEAL_SLOT_SLUGS, type MealSlotSlug } from './constants';
import { zonedTime } from './time';

/** Xác định buổi ăn mặc định theo thời điểm và múi giờ cấu hình (UC11). */
export function currentMealSlot(date: Date, timeZone: string): MealSlotSlug {
  const { hour } = zonedTime(date, timeZone);
  for (const slug of MEAL_SLOT_SLUGS) {
    const { start, end } = MEAL_SLOT_HOURS[slug];
    const inRange = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    if (inRange) return slug;
  }
  return 'bua-toi';
}

export function isMealSlotSlug(value: unknown): value is MealSlotSlug {
  return typeof value === 'string' && (MEAL_SLOT_SLUGS as readonly string[]).includes(value);
}
