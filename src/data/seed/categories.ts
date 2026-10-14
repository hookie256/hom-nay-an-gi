import type { Category, CategoryType } from '@/types/models';

const T = '2026-09-20T00:00:00.000Z';
const c = (type: CategoryType, slug: string, name: string, displayOrder: number, status: Category['status'] = 'active'): Category => ({
  _id: `cat-${slug}`, type, slug, name, status, displayOrder, createdAt: T, updatedAt: T,
});

export const seedCategories: Category[] = [
  c('mealSlot', 'bua-sang', 'Bữa sáng', 1),
  c('mealSlot', 'bua-trua', 'Bữa trưa', 2),
  c('mealSlot', 'bua-chieu', 'Bữa chiều', 3),
  c('mealSlot', 'bua-toi', 'Bữa tối', 4),
  c('dishType', 'mon-nuoc', 'Món nước', 1),
  c('dishType', 'mon-xao', 'Món xào', 2),
  c('dishType', 'mon-kho', 'Món kho, rim', 3),
  c('dishType', 'mon-chien', 'Món chiên, áp chảo', 4),
  c('dishType', 'mon-canh', 'Canh', 5),
  c('dishType', 'mon-goi', 'Gỏi, nộm, salad', 6),
  c('dishType', 'mon-com', 'Cơm, xôi, cháo', 7),
  c('dishType', 'an-vat', 'Ăn vặt', 8),
  c('cuisine', 'mien-bac', 'Miền Bắc', 1),
  c('cuisine', 'mien-trung', 'Miền Trung', 2),
  c('cuisine', 'mien-nam', 'Miền Nam', 3),
  c('cuisine', 'au-my', 'Âu – Mỹ', 4),
  c('cuisine', 'chau-a', 'Châu Á khác', 5),
  c('tag', 'nhanh-gon', 'Nhanh gọn', 1),
  c('tag', 'healthy', 'Lành mạnh', 2),
  c('tag', 'cho-tre-em', 'Hợp trẻ em', 3),
  c('tag', 'dai-tiec', 'Đãi khách', 4),
  c('tag', 'mon-tet', 'Món Tết', 5, 'hidden'),
];
