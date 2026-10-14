/**
 * Lớp service: nơi duy nhất giao diện gọi API. Thay mock bằng backend thật chỉ cần đặt
 * VITE_API_MODE=http và VITE_API_BASE_URL – không phải sửa component.
 */
import type {
  AdminAuditRow, AdminDishRow, AdminOrderRow, AdminReportRow, AdminReviewRow, AdminUserRow, AuthResult, CartView, CategoryRow,
  CreateOrderRequest, DishDetail, DishInput, DishListQuery, DishListResult, FavoriteItem, HistoryItem, IngredientRow, MyReview,
  OrderDetail, Paginated, PublicReview, RecommendationRequest, RecommendationResult, ReplaceResult, SellingMenuRow, StatsOverview,
  StatsRecommendation, StatsTop, UnitRow, ValidationResult,
} from '@/types/api';
import type { Category, Dish, Ingredient, Order, OrderSettings, OrderStatus, PaymentStatus, PublicUser, Review, Role, TimeRange, Unit, UserProfile } from '@/types/models';
import { api } from './apiClient';

export interface IngredientOption {
  _id: string;
  canonicalName: string;
  aliases: string[];
  groupId?: string;
  avoidTags: string[];
  matchedAlias?: string;
}

export const authService = {
  register: (b: { name: string; email: string; password: string }) => api.post<{ user: PublicUser }>('/auth/register', b),
  login: (b: { email: string; password: string }) => api.post<AuthResult>('/auth/login', b),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  me: () => api.get<{ user: PublicUser; expiresAt: string }>('/auth/me'),
  forgotPassword: (email: string) => api.post<{ ok: true; message: string; devResetLink?: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post<{ ok: true }>('/auth/reset-password', { token, password }),
};

export const profileService = {
  get: () => api.get<{ profile: UserProfile; email: string }>('/profile'),
  update: (patch: Partial<UserProfile>) => api.patch<{ profile: UserProfile }>('/profile', patch),
};

export const catalogService = {
  categories: () => api.get<{ items: Category[] }>('/categories'),
  units: () => api.get<{ items: Unit[] }>('/units'),
  ingredients: (q?: string) => api.get<{ items: IngredientOption[] }>('/ingredients', { q }),
  dishes: (query: DishListQuery) => api.get<DishListResult>('/dishes', query as Record<string, string | number | string[] | undefined>),
  dish: (slug: string) => api.get<DishDetail>(`/dishes/${encodeURIComponent(slug)}`),
  logView: (dishId: string, recommendationEventId?: string) => api.post<{ ok: true; recordedInHistory: boolean }>('/events/view', { dishId, recommendationEventId }),
  reviews: (dishId: string, page = 1) => api.get<Paginated<PublicReview>>(`/dishes/${dishId}/reviews`, { page }),
};

export const recommendationService = {
  get: (req: RecommendationRequest) => api.post<RecommendationResult>('/recommendations', req),
  replace: (eventId: string, dishId: string) => api.post<ReplaceResult>(`/recommendations/${eventId}/replace`, { dishId }),
  choose: (eventId: string, dishId: string) => api.post<{ ok: true }>(`/recommendations/${eventId}/choose`, { dishId }),
  getSelection: () => api.get<{ ingredientIds: string[] }>('/ingredient-selections'),
  saveSelection: (ingredientIds: string[]) => api.put<{ ingredientIds: string[] }>('/ingredient-selections', { ingredientIds }),
};

export const favoriteService = {
  list: (q?: string, page = 1) => api.get<Paginated<FavoriteItem>>('/favorites', { q, page }),
  add: (dishId: string) => api.post<{ isFavorite: true }>('/favorites', { dishId }),
  remove: (dishId: string) => api.delete<{ isFavorite: false }>(`/favorites/${dishId}`),
};

export const reviewService = {
  mine: (dishId: string) => api.get<{ review: MyReview | null }>(`/dishes/${dishId}/my-review`),
  create: (dishId: string, rating: number, body?: string) => api.post<{ review: Review }>('/reviews', { dishId, rating, body }),
  update: (id: string, rating: number, body?: string) => api.patch<{ review: Review }>(`/reviews/${id}`, { rating, body }),
  remove: (id: string) => api.delete<{ ok: true }>(`/reviews/${id}`),
  report: (id: string, reason: string) => api.post<{ duplicate: boolean; message: string }>(`/reviews/${id}/reports`, { reason }),
};

export const historyService = {
  list: (q: { type?: string; from?: string; to?: string; page?: number }) => api.get<Paginated<HistoryItem> & { saveHistory: boolean }>('/history', q),
  remove: (id: string) => api.delete<{ ok: true }>(`/history/${id}`),
  clear: () => api.delete<{ deleted: number }>('/history'),
};

export const cartService = {
  get: () => api.get<CartView>('/cart'),
  add: (dishId: string, quantity: number) => api.post<CartView>('/cart/items', { dishId, quantity }),
  update: (dishId: string, quantity: number) => api.patch<CartView>(`/cart/items/${dishId}`, { quantity }),
  remove: (dishId: string) => api.delete<CartView>(`/cart/items/${dishId}`),
  confirmPrices: () => api.post<CartView>('/cart/confirm-prices'),
  removeUnavailable: () => api.post<CartView>('/cart/remove-unavailable'),
};

export const orderService = {
  create: (req: CreateOrderRequest) => api.post<OrderDetail>('/orders', req),
  list: (page = 1, status?: OrderStatus) => api.get<Paginated<Order>>('/orders', { page, status }),
  get: (id: string) => api.get<OrderDetail>(`/orders/${id}`),
  cancel: (id: string, reason: string) => api.post<{ result: 'cancelled' | 'requested'; order: OrderDetail }>(`/orders/${id}/cancel`, { reason }),
};

export const adminService = {
  // món ăn
  dishes: (q: { q?: string; status?: string; page?: number }) => api.get<Paginated<AdminDishRow> & { counts: Record<string, number> }>('/admin/dishes', q),
  dish: (id: string) => api.get<{ dish: Dish }>(`/admin/dishes/${id}`),
  createDish: (input: Partial<DishInput>) => api.post<{ dish: Dish }>('/admin/dishes', input),
  updateDish: (id: string, input: Partial<DishInput> & { version: number }) => api.patch<{ dish: Dish; revertedToDraft: boolean }>(`/admin/dishes/${id}`, input),
  validateDish: (id: string) => api.post<ValidationResult>(`/admin/dishes/${id}/validate`),
  publishDish: (id: string) => api.post<{ dish: Dish }>(`/admin/dishes/${id}/publish`),
  hideDish: (id: string, reason?: string) => api.post<{ dish: Dish }>(`/admin/dishes/${id}/hide`, { reason }),
  dishReferences: (id: string) => api.get<{ references: Record<string, number>; canDelete: boolean }>(`/admin/dishes/${id}/references`),
  deleteDish: (id: string) => api.delete<{ ok: true }>(`/admin/dishes/${id}`),
  // nguyên liệu & đơn vị
  ingredients: (q: { q?: string; group?: string; status?: string; page?: number; pageSize?: number }) => api.get<Paginated<IngredientRow>>('/admin/ingredients', q),
  createIngredient: (b: Partial<Ingredient>) => api.post<{ ingredient: Ingredient }>('/admin/ingredients', b),
  updateIngredient: (id: string, b: Partial<Ingredient>) => api.patch<{ ingredient: Ingredient }>(`/admin/ingredients/${id}`, b),
  setSubstitutions: (id: string, items: { ingredientId: string; note?: string }[]) => api.put<{ ingredient: Ingredient }>(`/admin/ingredients/${id}/substitutions`, { items }),
  setIngredientStatus: (id: string, status: 'active' | 'inactive') => api.post<{ ingredient: Ingredient }>(`/admin/ingredients/${id}/status`, { status }),
  deleteIngredient: (id: string) => api.delete<{ ok: true }>(`/admin/ingredients/${id}`),
  units: () => api.get<{ items: UnitRow[] }>('/admin/units'),
  createUnit: (b: { name: string; symbol: string }) => api.post<{ unit: Unit }>('/admin/units', b),
  updateUnit: (id: string, b: Partial<Unit>) => api.patch<{ unit: Unit }>(`/admin/units/${id}`, b),
  deleteUnit: (id: string) => api.delete<{ ok: true }>(`/admin/units/${id}`),
  // danh mục
  categories: (type?: string) => api.get<{ items: CategoryRow[] }>('/admin/categories', { type }),
  createCategory: (b: Partial<Category>) => api.post<{ category: Category }>('/admin/categories', b),
  updateCategory: (id: string, b: Partial<Category>) => api.patch<{ category: Category; affectedDishes: number }>(`/admin/categories/${id}`, b),
  // người dùng
  users: (q: { q?: string; role?: string; status?: string; page?: number }) => api.get<Paginated<AdminUserRow>>('/admin/users', q),
  setUserStatus: (id: string, status: 'active' | 'locked', reason: string, expectedStatus?: string) => api.patch<{ user: PublicUser }>(`/admin/users/${id}/status`, { status, reason, expectedStatus }),
  setUserRole: (id: string, role: Role, reason: string) => api.patch<{ user: PublicUser }>(`/admin/users/${id}/role`, { role, reason }),
  auditLogs: (q: { actor?: string; action?: string; targetType?: string; from?: string; to?: string; page?: number }) => api.get<Paginated<AdminAuditRow> & { actions: string[] }>('/admin/audit-logs', q),
  // kiểm duyệt
  reviews: (q: { status?: string; dish?: string; page?: number }) => api.get<Paginated<AdminReviewRow>>('/admin/reviews', q),
  moderateReview: (id: string, moderationStatus: 'published' | 'hidden', reason?: string, expectedStatus?: string) => api.patch<{ review: Review }>(`/admin/reviews/${id}`, { moderationStatus, reason, expectedStatus }),
  reports: (q: { status?: string; page?: number }) => api.get<Paginated<AdminReportRow>>('/admin/review-reports', q),
  resolveReport: (id: string, decision: 'keep' | 'hide', note?: string) => api.post<{ ok: true }>(`/admin/review-reports/${id}/resolve`, { decision, note }),
  // thực đơn bán
  sellingMenus: () => api.get<{ items: SellingMenuRow[]; settings: OrderSettings }>('/admin/selling-menus'),
  enableSelling: (b: { dishId: string; price: number; available?: boolean; receivingHours?: TimeRange[] }) => api.post<{ menu: SellingMenuRow }>('/admin/selling-menus', b),
  updateSelling: (id: string, b: { price?: number; available?: boolean; receivingHours?: TimeRange[] | null }) => api.patch<{ menu: SellingMenuRow }>(`/admin/selling-menus/${id}`, b),
  disableSelling: (id: string) => api.delete<{ ok: true }>(`/admin/selling-menus/${id}`),
  updateOrderSettings: (b: Partial<OrderSettings>) => api.put<{ settings: OrderSettings }>('/admin/order-settings', b),
  // đơn hàng
  orders: (q: { group?: string; q?: string; page?: number }) => api.get<Paginated<AdminOrderRow> & { counts: Record<string, number>; cancelRequests: number }>('/admin/orders', q),
  order: (id: string) => api.get<OrderDetail>(`/admin/orders/${id}`),
  setOrderStatus: (id: string, toStatus: OrderStatus, expectedStatus: OrderStatus, reason?: string) => api.patch<OrderDetail>(`/admin/orders/${id}/status`, { toStatus, expectedStatus, reason }),
  decideCancel: (id: string, decision: 'approve' | 'reject', reason: string) => api.post<OrderDetail>(`/admin/orders/${id}/cancel-request`, { decision, reason }),
  setPayment: (id: string, paymentStatus: PaymentStatus) => api.patch<OrderDetail>(`/admin/orders/${id}/payment`, { paymentStatus }),
  // thống kê
  statsOverview: (from?: string, to?: string) => api.get<StatsOverview>('/admin/stats/overview', { from, to }),
  statsTop: (from?: string, to?: string) => api.get<StatsTop>('/admin/stats/top', { from, to }),
  statsRecommendation: (from?: string, to?: string) => api.get<StatsRecommendation>('/admin/stats/recommendation', { from, to }),
};
