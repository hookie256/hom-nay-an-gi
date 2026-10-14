import { describe, expect, it } from 'vitest';
import type { Dish, Ingredient, OrderSettings, SellingMenu } from '@/types/models';
import { computeIngredientMatch, compareMatch } from './ingredientMatch';
import { currentMealSlot } from './mealSlot';
import { scaleQuantity, formatQuantity } from './scaling';
import { checkOrderable, isWithinHours, validateTimeRanges } from './selling';
import { validateDishForPublish, renumberSteps } from './publishValidation';
import { canAdminTransition, userCancelMode, paymentAfterCancellation, canAdminSetPayment } from './orderStateMachine';
import { recommend, weightedScore, checkAvoid } from './recommendation';
import { filterDishes, sortDishes } from './dishFilter';
import { validateCart } from './cartValidation';
import { normalizeText, slugify } from './text';

const now = '2026-01-01T00:00:00.000Z';
const ing = (id: string, name = id): Ingredient => ({ _id: id, canonicalName: name, aliases: [], substitutionIds: [], avoidTags: [], status: 'active' });
const dish = (over: Partial<Dish>): Dish => ({
  _id: 'd1', slug: 'd1', name: 'Món', images: [], mealSlotIds: ['toi'], categoryIds: [], cuisineIds: [], tasteTags: [],
  baseServings: 2, prepMinutes: 10, cookMinutes: 10, difficulty: 'easy', status: 'published',
  ingredients: [
    { ingredientId: 'trung', quantity: 3, unitId: 'qua', required: true },
    { ingredientId: 'ca-chua', quantity: 2, unitId: 'qua', required: true },
    { ingredientId: 'hanh', quantity: 1, unitId: 'cay', required: true },
    { ingredientId: 'tieu', quantity: 1, unitId: 'g', required: false },
  ],
  steps: [{ stepNo: 1, title: 'Nấu', instruction: 'Nấu chín' }], version: 1, createdAt: now, updatedAt: now, ...over,
});
const ingMap = new Map(['trung', 'ca-chua', 'hanh', 'tieu', 'tom'].map((id) => [id, ing(id)]));

describe('Độ khớp nguyên liệu (5.11)', () => {
  it('ví dụ trong báo cáo: có trứng và cà chua → 2/3, thiếu hành', () => {
    const m = computeIngredientMatch(dish({}).ingredients, ['trung', 'ca-chua']);
    expect(m.requiredTotal).toBe(3);
    expect(m.requiredHave).toBe(2);
    expect(Math.round(m.ratio! * 100)).toBe(67);
    expect(m.missingIds).toEqual(['hanh']);
  });
  it('nguyên liệu tùy chọn không làm giảm tỷ lệ; chọn trùng chỉ tính một lần', () => {
    const m = computeIngredientMatch(dish({}).ingredients, ['trung', 'trung', 'ca-chua', 'hanh']);
    expect(m.ratio).toBe(1);
    expect(m.optionalIds).toEqual(['tieu']);
  });
  it('công thức không có nguyên liệu bắt buộc → ratio null', () => {
    expect(computeIngredientMatch([], ['trung']).ratio).toBeNull();
  });
  it('cùng tỷ lệ thì thiếu ít hơn đứng trước', () => {
    const a = { ...computeIngredientMatch(dish({}).ingredients, ['trung']), ratio: 0.5, missingIds: ['x'] };
    const b = { ...a, missingIds: ['x', 'y'] };
    expect(compareMatch(a, b)).toBeLessThan(0);
  });
});

describe('Buổi ăn mặc định theo múi giờ', () => {
  const tz = 'Asia/Ho_Chi_Minh';
  it.each([
    ['2026-10-14T00:30:00Z', 'bua-sang'], // 07:30
    ['2026-10-14T05:00:00Z', 'bua-trua'], // 12:00
    ['2026-10-14T08:00:00Z', 'bua-chieu'], // 15:00
    ['2026-10-14T12:00:00Z', 'bua-toi'], // 19:00
    ['2026-10-14T19:00:00Z', 'bua-toi'], // 02:00
  ])('%s → %s', (iso, slot) => expect(currentMealSlot(new Date(iso), tz)).toBe(slot));
});

describe('Điều chỉnh khẩu phần (UC30)', () => {
  it('2 → 4 khẩu phần thì nhân đôi', () => expect(scaleQuantity(200, 2, 4, 'g')).toBe(400));
  it('làm tròn đơn vị đếm tới 0,5', () => expect(scaleQuantity(3, 2, 3, 'quả')).toBe(4.5));
  it('từ chối khẩu phần không dương', () => expect(() => scaleQuantity(1, 2, 0, 'g')).toThrow());
  it('định dạng phân số', () => expect(formatQuantity(1.5)).toBe('1½'));
});

describe('Thực đơn bán hàng', () => {
  const settings: OrderSettings = { timezone: 'Asia/Ho_Chi_Minh', defaultReceivingHours: [{ start: '08:00', end: '20:00' }], maxQuantityPerItem: 20, updatedAt: now };
  const menu: SellingMenu = { _id: 'm', dishId: 'd1', price: 50000, currency: 'VND', available: true, validFrom: '2026-01-01T00:00:00Z', createdAt: now, updatedAt: now };
  it('trong giờ và còn bán → đặt được', () => expect(checkOrderable(menu, settings, new Date('2026-10-14T05:00:00Z')).orderable).toBe(true));
  it('ngoài giờ → outside_hours', () => expect(checkOrderable(menu, settings, new Date('2026-10-14T15:00:00Z'))).toEqual({ orderable: false, reason: 'outside_hours' }));
  it('tạm ngừng → unavailable', () => expect(checkOrderable({ ...menu, available: false }, settings, new Date('2026-10-14T05:00:00Z'))).toEqual({ orderable: false, reason: 'unavailable' }));
  it('không có bản ghi bán → not_selling', () => expect(checkOrderable(undefined, settings, new Date())).toEqual({ orderable: false, reason: 'not_selling' }));
  it('khung giờ qua nửa đêm', () => expect(isWithinHours([{ start: '22:00', end: '02:00' }], new Date('2026-10-14T17:30:00Z'), 'Asia/Ho_Chi_Minh')).toBe(true));
  it('khung giờ sai định dạng bị từ chối', () => expect(validateTimeRanges([{ start: '25:00', end: '10:00' }])).not.toBeNull());
});

describe('Kiểm tra giỏ (UC46)', () => {
  const settings: OrderSettings = { timezone: 'Asia/Ho_Chi_Minh', defaultReceivingHours: [{ start: '00:00', end: '23:59' }], maxQuantityPerItem: 20, updatedAt: now };
  const menu: SellingMenu = { _id: 'm', dishId: 'd1', price: 55000, currency: 'VND', available: true, validFrom: '2020-01-01T00:00:00Z', createdAt: now, updatedAt: now };
  const ctx = { dishById: new Map([['d1', dish({})]]), menuByDishId: new Map([['d1', menu]]), settings, now: new Date('2026-10-14T05:00:00Z') };
  it('phát hiện giá đổi so với giá đã thấy', () => {
    const r = validateCart([{ dishId: 'd1', quantity: 2, seenPrice: 50000 }], ctx);
    expect(r.ok).toBe(false);
    expect(r.issues[0]).toMatchObject({ type: 'price_changed', oldPrice: 50000, newPrice: 55000 });
    expect(r.total).toBe(110000);
  });
  it('số lượng vượt giới hạn', () => expect(validateCart([{ dishId: 'd1', quantity: 21, seenPrice: 55000 }], ctx).issues[0].type).toBe('invalid_quantity'));
  it('giỏ rỗng không hợp lệ', () => expect(validateCart([], ctx).ok).toBe(false));
});

describe('Kiểm tra xuất bản (UC63)', () => {
  const refs = { activeMealSlotIds: new Set(['toi']), ingredientIds: new Set(ingMap.keys()), unitIds: new Set(['qua', 'cay', 'g']) };
  it('món đủ dữ liệu không có lỗi', () => expect(validateDishForPublish(dish({}), refs)).toEqual([]));
  it('thiếu bước, nguyên liệu bắt buộc, khẩu phần', () => {
    const issues = validateDishForPublish(dish({ steps: [], ingredients: [], baseServings: 0 }), refs).map((i) => i.field);
    expect(issues).toEqual(expect.arrayContaining(['steps', 'ingredients', 'baseServings']));
  });
  it('bước trùng số thứ tự', () => {
    const issues = validateDishForPublish(dish({ steps: [{ stepNo: 1, title: 'a', instruction: 'a' }, { stepNo: 1, title: 'b', instruction: 'b' }] }), refs);
    expect(issues.some((i) => i.message.includes('trùng'))).toBe(true);
  });
  it('đánh lại số thứ tự', () => expect(renumberSteps([{ stepNo: 5 }, { stepNo: 2 }]).map((s) => s.stepNo)).toEqual([1, 2]));
});

describe('Trạng thái đơn (5.12)', () => {
  it('đi đúng trình tự', () => {
    expect(canAdminTransition('pending', 'confirmed')).toBe(true);
    expect(canAdminTransition('confirmed', 'preparing')).toBe(true);
    expect(canAdminTransition('preparing', 'completed')).toBe(true);
  });
  it('không bỏ bước, không quay lại đơn đã kết thúc', () => {
    expect(canAdminTransition('pending', 'completed')).toBe(false);
    expect(canAdminTransition('completed', 'preparing')).toBe(false);
    expect(canAdminTransition('confirmed', 'rejected')).toBe(false);
  });
  it('quy tắc hủy', () => {
    expect(userCancelMode('pending', false)).toBe('direct');
    expect(userCancelMode('confirmed', false)).toBe('request');
    expect(userCancelMode('confirmed', true)).toBe('not_allowed');
    expect(userCancelMode('preparing', false)).toBe('not_allowed');
  });
  it('đơn đã thanh toán bị hủy → chờ hoàn tiền', () => {
    expect(paymentAfterCancellation('paid')).toBe('refund_pending');
    expect(paymentAfterCancellation('unpaid')).toBe('unpaid');
    expect(canAdminSetPayment('unpaid', 'paid')).toBe(true);
    expect(canAdminSetPayment('paid', 'unpaid')).toBe(false);
  });
});

describe('Thuật toán gợi ý (5.10)', () => {
  const dishes = [
    dish({ _id: 'a', name: 'Trứng sốt cà chua' }),
    dish({ _id: 'b', name: 'Tôm rang', ingredients: [{ ingredientId: 'tom', quantity: 1, unitId: 'g', required: true }] }),
    dish({ _id: 'c', name: 'Món sáng', mealSlotIds: ['sang'] }),
    dish({ _id: 'd', name: 'Món nháp', status: 'draft' }),
    dish({ _id: 'e', name: 'Món thiếu dữ liệu', ingredients: [{ ingredientId: 'khong-ton-tai', quantity: 1, unitId: 'g', required: true }] }),
  ];
  const base = { dishes, ingredientById: ingMap, categoryName: new Map<string, string>(), mealSlot: { id: 'toi', name: 'Bữa tối' } };

  it('chỉ món published, đúng buổi', () => {
    const ids = recommend(base).ranked.map((r) => r.dish._id);
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('d');
  });
  it('loại món chứa nguyên liệu cần tránh và món thiếu dữ liệu thành phần', () => {
    const r = recommend({ ...base, excludeIngredientIds: ['tom'] });
    const ids = r.ranked.map((x) => x.dish._id);
    expect(ids).toEqual(['a']);
    expect(r.excludedUnknown).toBe(1);
  });
  it('không tự bỏ điều kiện cần tránh khi kết quả rỗng', () => {
    const r = recommend({ ...base, excludeIngredientIds: ['tom', 'trung'] });
    expect(r.ranked).toEqual([]);
    expect(r.emptyStage).toBe('avoid');
  });
  it('lý do gợi ý dựa trên dữ liệu thực', () => {
    const r = recommend({ ...base, ingredientIds: ['trung', 'ca-chua'] });
    expect(r.ranked[0].dish._id).toBe('a');
    expect(r.ranked[0].reasons).toEqual(expect.arrayContaining(['Phù hợp bữa tối', 'Đã có 2/3 nguyên liệu bắt buộc']));
  });
  it('món vừa bỏ qua không quay lại trong cùng lượt', () => {
    const ids = recommend({ ...base, skippedDishIds: new Set(['a']) }).ranked.map((r) => r.dish._id);
    expect(ids).not.toContain('a');
  });
  it('lọc theo giới hạn thời gian rõ ràng', () => expect(recommend({ ...base, maxMinutes: 5 }).emptyStage).toBe('time'));
  it('chế độ ăn: món chưa khai báo không được xem là phù hợp', () => expect(recommend({ ...base, diet: ['chay'] }).emptyStage).toBe('diet'));
  it('trọng số được phân bổ lại khi thiếu tín hiệu', () => {
    expect(weightedScore({ diversity: 1 })).toBe(1);
    expect(weightedScore({ diversity: 1, ingredients: 0 })).toBeCloseTo(15 / 55, 3);
  });
  it('checkAvoid trả unknown khi tham chiếu nguyên liệu không tồn tại', () => {
    expect(checkAvoid(dishes[4], new Set(['tom']), ingMap)).toBe('unknown');
  });
});

describe('Bộ lọc danh sách (6.6)', () => {
  const dishes = [dish({ _id: 'a', name: 'Phở bò', mealSlotIds: ['sang'] }), dish({ _id: 'b', name: 'Cơm tấm', mealSlotIds: ['trua'] }), dish({ _id: 'c', name: 'Bún chả', mealSlotIds: ['toi'], status: 'hidden' })];
  it('nhiều lựa chọn trong một nhóm = thỏa ít nhất một', () => {
    expect(filterDishes(dishes, { mealSlotIds: ['sang', 'trua'] }, ingMap).items.map((d) => d._id)).toEqual(['a', 'b']);
  });
  it('tìm không dấu, bỏ khoảng trắng thừa; không trả món ẩn', () => {
    expect(filterDishes(dishes, { q: '  pho   bo ' }, ingMap).items.map((d) => d._id)).toEqual(['a']);
    expect(filterDishes(dishes, { q: 'bun cha' }, ingMap).items).toEqual([]);
  });
  it('món thiếu giá trị sắp xếp đặt cuối', () => {
    const sorted = sortDishes(dishes.slice(0, 2), 'rating', { rating: new Map([['b', { avg: 4, count: 1 }]]), popularity: new Map() });
    expect(sorted.map((d) => d._id)).toEqual(['b', 'a']);
  });
});

describe('Chuẩn hóa văn bản', () => {
  it('bỏ dấu tiếng Việt', () => expect(normalizeText('  Đậu  Phụ Sốt ')).toBe('dau phu sot'));
  it('slug', () => expect(slugify('Trứng sốt cà chua')).toBe('trung-sot-ca-chua'));
});
