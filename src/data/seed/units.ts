import type { Unit } from '@/types/models';

const T = '2026-09-20T00:00:00.000Z';
const u = (code: string, name: string, symbol: string, status: Unit['status'] = 'active'): Unit => ({
  _id: `unit-${code}`, name, symbol, status, createdAt: T, updatedAt: T,
});

export const seedUnits: Unit[] = [
  u('g', 'gram', 'g'),
  u('kg', 'kilôgam', 'kg'),
  u('ml', 'mililít', 'ml'),
  u('l', 'lít', 'l'),
  u('qua', 'quả', 'quả'),
  u('cu', 'củ', 'củ'),
  u('tep', 'tép', 'tép'),
  u('cay', 'cây', 'cây'),
  u('thia-canh', 'thìa canh', 'thìa canh'),
  u('thia-ca-phe', 'thìa cà phê', 'thìa cà phê'),
  u('bo', 'bó', 'bó'),
  u('nam', 'nắm', 'nắm'),
  u('lat', 'lát', 'lát'),
  u('mieng', 'miếng', 'miếng'),
  u('chen', 'chén', 'chén'),
  u('goi', 'gói', 'gói'),
  u('la', 'lá', 'lá'),
  u('chiec', 'chiếc', 'chiếc'),
  u('lang', 'lạng', 'lạng', 'inactive'),
];
