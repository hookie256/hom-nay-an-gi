import type { CartItem, Dish, Id, OrderSettings, SellingMenu } from '@/types/models';
import { checkOrderable, type NotOrderableReason } from './selling';

export type CartIssue =
  | { dishId: Id; type: 'price_changed'; oldPrice: number; newPrice: number }
  | { dishId: Id; type: 'not_orderable'; reason: NotOrderableReason }
  | { dishId: Id; type: 'invalid_quantity'; max: number };

export interface ValidatedLine {
  dishId: Id;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  orderable: boolean;
}

/**
 * Kiểm tra giỏ trước khi đặt (UC46): giá, trạng thái bán, giờ nhận đơn, số lượng.
 * Giá luôn lấy từ selling_menus tại máy chủ – không dùng giá trình duyệt gửi lên.
 */
export function validateCart(
  items: CartItem[],
  ctx: { dishById: Map<Id, Dish>; menuByDishId: Map<Id, SellingMenu>; settings: OrderSettings; now: Date },
): { lines: ValidatedLine[]; issues: CartIssue[]; total: number; ok: boolean } {
  const issues: CartIssue[] = [];
  const lines: ValidatedLine[] = items.map((item) => {
    const dish = ctx.dishById.get(item.dishId);
    const menu = ctx.menuByDishId.get(item.dishId);
    const check = checkOrderable(menu, ctx.settings, ctx.now, dish?.status === 'published');
    if (!check.orderable) issues.push({ dishId: item.dishId, type: 'not_orderable', reason: check.reason });
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > ctx.settings.maxQuantityPerItem)
      issues.push({ dishId: item.dishId, type: 'invalid_quantity', max: ctx.settings.maxQuantityPerItem });
    if (menu && check.orderable && item.seenPrice !== undefined && item.seenPrice !== menu.price)
      issues.push({ dishId: item.dishId, type: 'price_changed', oldPrice: item.seenPrice, newPrice: menu.price });
    const unitPrice = menu ? menu.price : null;
    return {
      dishId: item.dishId,
      name: dish?.name ?? 'Món không còn tồn tại',
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice !== null ? unitPrice * item.quantity : null,
      orderable: check.orderable,
    };
  });
  const total = lines.reduce((s, l) => s + (l.orderable && l.lineTotal ? l.lineTotal : 0), 0);
  return { lines, issues, total, ok: items.length > 0 && issues.length === 0 };
}
