import type {
  ActivityEvent, Cart, Favorite, Order, OrderEvent, OrderSettings, RecommendationEvent, Review, ReviewReport,
  Role, SearchEvent, SellingMenu, UserProfile, AccountStatus,
} from '@/types/models';
import { seedCategories } from './categories';
import { seedUnits } from './units';
import { seedIngredients } from './ingredients';
import { seedDishes } from './dishes';

/**
 * Tài khoản thử nghiệm (chỉ dùng cho môi trường mock/dev). Mật khẩu được băm khi khởi tạo CSDL giả.
 * Danh sách này cũng được ghi trong README.
 */
export const seedAccounts: { id: string; email: string; password: string; role: Role; status: AccountStatus; displayName: string }[] = [
  { id: 'user-super', email: 'super@homnayangi.test', password: 'Super@123', role: 'super_admin', status: 'active', displayName: 'Quản trị cấp cao' },
  { id: 'user-admin', email: 'admin@homnayangi.test', password: 'Admin@123', role: 'admin', status: 'active', displayName: 'Quản trị viên' },
  { id: 'user-an', email: 'an@homnayangi.test', password: 'User@123', role: 'user', status: 'active', displayName: 'Nguyễn An' },
  { id: 'user-binh', email: 'binh@homnayangi.test', password: 'User@123', role: 'user', status: 'active', displayName: 'Trần Bình' },
  { id: 'user-khoa', email: 'khoa@homnayangi.test', password: 'User@123', role: 'user', status: 'locked', displayName: 'Lê Khoa' },
];

export { seedCategories, seedUnits, seedIngredients, seedDishes };

/** Dữ liệu phụ thuộc thời điểm khởi tạo (đơn, sự kiện…) được sinh tương đối so với `now`. */
export function buildTimedSeed(now: Date) {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86400000 - hours * 3600000).toISOString();
  const iso = now.toISOString();

  const orderSettings: OrderSettings = {
    timezone: 'Asia/Ho_Chi_Minh',
    defaultReceivingHours: [{ start: '07:00', end: '21:00' }],
    maxQuantityPerItem: 20,
    updatedAt: iso,
  };

  const menu = (slug: string, price: number, extra: Partial<SellingMenu> = {}): SellingMenu => ({
    _id: `menu-${slug}`, dishId: `dish-${slug}`, price, currency: 'VND', available: true,
    validFrom: ago(20), validTo: null, createdAt: ago(20), updatedAt: ago(20), ...extra,
  });
  const sellingMenus: SellingMenu[] = [
    menu('trung-sot-ca-chua', 45000),
    menu('pho-bo', 55000),
    menu('bun-cha', 50000),
    menu('com-tam-suon-nuong', 45000),
    menu('banh-mi-op-la', 25000),
    menu('canh-chua-ca-loc', 60000),
    menu('thit-kho-trung', 65000),
    menu('goi-cuon-tom-thit', 40000),
    menu('ga-xao-sa-ot', 60000, { receivingHours: [{ start: '10:00', end: '14:00' }, { start: '17:00', end: '20:00' }] }),
    menu('banh-xeo', 50000, { available: false }),
  ];

  const profiles: UserProfile[] = seedAccounts.map((a) => ({
    _id: `profile-${a.id}`, userId: a.id, displayName: a.displayName, tastes: [], favoriteCategoryIds: [], cuisineIds: [],
    dietCodes: [], avoidedIngredientIds: [], saveHistory: false, createdAt: ago(25), updatedAt: ago(25),
  }));
  const an = profiles.find((p) => p.userId === 'user-an')!;
  Object.assign(an, {
    tastes: ['cay', 'chua'], cuisineIds: ['cat-mien-nam'], favoriteCategoryIds: ['cat-mon-canh'],
    avoidedIngredientIds: ['ing-tom'], preferredCookMinutes: 40, saveHistory: true,
  });

  const favorites: Favorite[] = [
    { _id: 'fav-1', userId: 'user-an', dishId: 'dish-canh-chua-ca-loc', createdAt: ago(10) },
    { _id: 'fav-2', userId: 'user-an', dishId: 'dish-ga-xao-sa-ot', createdAt: ago(8) },
    { _id: 'fav-3', userId: 'user-an', dishId: 'dish-lau-thai', createdAt: ago(30) },
    { _id: 'fav-4', userId: 'user-binh', dishId: 'dish-pho-bo', createdAt: ago(5) },
  ];

  const review = (id: string, userId: string, slug: string, rating: number, body: string, status: Review['moderationStatus'], days: number): Review => ({
    _id: id, userId, dishId: `dish-${slug}`, rating, body, moderationStatus: status, createdAt: ago(days), updatedAt: ago(days),
  });
  const reviews: Review[] = [
    review('rv-1', 'user-an', 'trung-sot-ca-chua', 5, 'Làm theo công thức rất dễ, cả nhà đều thích.', 'published', 12),
    review('rv-2', 'user-binh', 'trung-sot-ca-chua', 4, 'Ngon, nên thêm chút đường cho bớt chua.', 'published', 9),
    review('rv-3', 'user-binh', 'pho-bo', 5, 'Nước dùng thơm, đúng vị phở Bắc.', 'published', 7),
    review('rv-4', 'user-an', 'canh-chua-ca-loc', 4, 'Chua thanh, hợp ngày nóng.', 'published', 6),
    review('rv-5', 'user-binh', 'bun-cha', 2, 'Món này dở tệ, ai nấu cũng hỏng! Vào trang XYZ mua đồ ăn rẻ hơn.', 'published', 3),
    review('rv-6', 'user-an', 'ga-xao-sa-ot', 5, 'Cay vừa, thơm sả.', 'pending', 1),
    review('rv-7', 'user-khoa', 'com-chien-trung', 1, 'Nội dung đã bị ẩn do vi phạm.', 'hidden', 15),
  ];
  const reviewReports: ReviewReport[] = [
    { _id: 'rp-1', reviewId: 'rv-5', reporterId: 'user-an', reason: 'Spam hoặc quảng cáo', status: 'open', createdAt: ago(2), resolvedBy: null, resolvedAt: null },
  ];

  const carts: Cart[] = [
    {
      _id: 'cart-an', userId: 'user-an', updatedAt: ago(1),
      items: [
        { dishId: 'dish-com-tam-suon-nuong', quantity: 2, seenPrice: 40000 }, // giá đã đổi 40.000 → 45.000
        { dishId: 'dish-trung-sot-ca-chua', quantity: 1, seenPrice: 45000 },
        { dishId: 'dish-banh-xeo', quantity: 1, seenPrice: 50000 }, // đang tạm hết
      ],
    },
  ];

  const orders: Order[] = [];
  const orderEvents: OrderEvent[] = [];
  let seq = 1;
  const addOrder = (
    userId: string, lines: [slug: string, name: string, price: number, qty: number][], days: number,
    path: Order['orderStatus'][], payment: Order['paymentStatus'], extra: Partial<Order> = {},
  ) => {
    const id = `order-${seq}`;
    const items = lines.map(([slug, name, price, qty]) => ({ dishId: `dish-${slug}`, snapshotName: name, unitPrice: price, quantity: qty, lineTotal: price * qty }));
    const created = ago(days);
    const o: Order = {
      _id: id, code: `HNAG-${String(100 + seq)}`, userId, items, total: items.reduce((s, i) => s + i.lineTotal, 0), currency: 'VND',
      receiveInfo: userId === 'user-an'
        ? { receiverName: 'Nguyễn An', phone: '0901234567', method: 'delivery', address: '12 Trần Duy Hưng, Cầu Giấy, Hà Nội' }
        : { receiverName: 'Trần Bình', phone: '0912345678', method: 'pickup' },
      orderStatus: path[path.length - 1], paymentStatus: payment, paymentMethod: 'cod', createdAt: created, updatedAt: created, ...extra,
    };
    orders.push(o);
    path.forEach((st, i) => orderEvents.push({
      _id: `oe-${seq}-${i}`, orderId: id, fromStatus: i === 0 ? null : path[i - 1], toStatus: st,
      actorId: i === 0 ? userId : 'user-admin', reason: st === 'rejected' ? extra.rejectReason : undefined,
      createdAt: new Date(Date.parse(created) + i * 20 * 60000).toISOString(),
    }));
    seq++;
  };
  // Giá trong đơn cũ (40.000) khác giá hiện tại (45.000) – kiểm thử NFR12
  addOrder('user-an', [['com-tam-suon-nuong', 'Cơm tấm sườn nướng', 40000, 2], ['banh-mi-op-la', 'Bánh mì trứng ốp la', 25000, 1]], 14, ['pending', 'confirmed', 'preparing', 'completed'], 'paid');
  addOrder('user-an', [['pho-bo', 'Phở bò', 55000, 2]], 0.05, ['pending', 'confirmed', 'preparing'], 'unpaid');
  addOrder('user-an', [['trung-sot-ca-chua', 'Trứng sốt cà chua', 45000, 1]], 0.02, ['pending'], 'unpaid');
  addOrder('user-binh', [['bun-cha', 'Bún chả', 50000, 3]], 0.1, ['pending', 'confirmed'], 'unpaid', {
    cancelRequest: { reason: 'Tôi đặt nhầm số lượng.', requestedAt: ago(0, 1), status: 'pending' },
  });
  addOrder('user-binh', [['goi-cuon-tom-thit', 'Gỏi cuốn tôm thịt', 40000, 4]], 3, ['pending', 'rejected'], 'unpaid', { rejectReason: 'Hết nguyên liệu tôm trong ngày.' });
  addOrder('user-binh', [['thit-kho-trung', 'Thịt kho trứng', 65000, 1]], 6, ['pending', 'confirmed', 'preparing', 'completed'], 'paid');

  // ---- Sự kiện cho thống kê (sinh xác định, không ngẫu nhiên) ----
  const recommendationEvents: RecommendationEvent[] = [];
  const activityEvents: ActivityEvent[] = [];
  const searchEvents: SearchEvent[] = [];
  const published = seedDishes.filter((d) => d.status === 'published');
  for (let i = 0; i < 60; i++) {
    const day = i % 28;
    const slot = ['bua-sang', 'bua-trua', 'bua-chieu', 'bua-toi'][i % 4];
    const suggested = [0, 1, 2, 3].map((k) => published[(i * 3 + k * 5) % published.length]._id);
    const opened = i % 3 === 0 ? [suggested[0]] : i % 5 === 0 ? [suggested[1], suggested[2]] : [];
    const chosen = i % 6 === 0 ? suggested[0] : undefined;
    const userId = i % 2 === 0 ? 'user-an' : null;
    const id = `re-seed-${i}`;
    recommendationEvents.push({
      _id: id, userId, requestCriteria: { mode: i % 7 === 0 ? 'ingredients' : 'meal', mealSlot: slot }, suggestedDishIds: suggested,
      chosenDishId: chosen, dismissedDishIds: i % 4 === 0 ? [suggested[3]] : [], openedDishIds: opened, displayStatus: 'shown', createdAt: ago(day, i % 12),
    });
    if (userId) {
      opened.forEach((d) => activityEvents.push({ _id: `ae-${i}-${d}`, userId, eventType: 'view_dish', dishId: d, recommendationEventId: id, createdAt: ago(day, i % 12) }));
      if (chosen) activityEvents.push({ _id: `ae-c-${i}`, userId, eventType: 'choose_from_recommendation', dishId: chosen, recommendationEventId: id, createdAt: ago(day, i % 12) });
    }
  }
  const keywords = ['phở', 'trứng', 'canh chua', 'bún', 'gà', 'phở', 'cơm tấm', 'trứng', 'chay', 'phở'];
  keywords.forEach((k, i) => searchEvents.push({ _id: `se-${i}`, keyword: k, createdAt: ago(i * 2) }));
  [['ing-trung-ga', 'ing-ca-chua'], ['ing-trung-ga'], ['ing-thit-ga', 'ing-sa'], ['ing-trung-ga', 'ing-hanh-la']].forEach((ids, i) =>
    searchEvents.push({ _id: `se-i-${i}`, ingredientIds: ids, createdAt: ago(i * 3) }),
  );

  // Lượt xem tổng hợp (ẩn danh) – sinh từ các lượt mở món của sự kiện gợi ý
  const dishViewStats: { dishId: string; date: string; views: number }[] = [];
  recommendationEvents.forEach((ev, i) => ev.openedDishIds.forEach((d) => {
    const date = ev.createdAt.slice(0, 10);
    const s = dishViewStats.find((x) => x.dishId === d && x.date === date);
    if (s) s.views += 1 + (i % 3);
    else dishViewStats.push({ dishId: d, date, views: 1 + (i % 3) });
  }));

  return { dishViewStats, orderSettings, sellingMenus, profiles, favorites, reviews, reviewReports, carts, orders, orderEvents, recommendationEvents, activityEvents, searchEvents };
}
