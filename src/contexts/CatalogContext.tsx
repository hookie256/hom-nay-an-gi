import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Category, CategoryType, Unit } from '@/types/models';
import { catalogService } from '@/services';
import { useQuery } from '@/hooks/useQuery';

interface CatalogApi {
  categories: Category[];
  units: Unit[];
  loading: boolean;
  error: string | null;
  byType: (t: CategoryType) => Category[];
  byId: Map<string, Category>;
  reload: () => void;
}

const Ctx = createContext<CatalogApi | null>(null);

/** Danh mục và đơn vị dùng chung, tải một lần cho toàn ứng dụng (không hardcode trong component). */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const q = useQuery(async () => {
    const [c, u] = await Promise.all([catalogService.categories(), catalogService.units()]);
    return { categories: c.items, units: u.items };
  }, []);
  const value = useMemo<CatalogApi>(() => {
    const categories = q.data?.categories ?? [];
    return {
      categories,
      units: q.data?.units ?? [],
      loading: q.loading,
      error: q.error?.message ?? null,
      byType: (t) => categories.filter((c) => c.type === t),
      byId: new Map(categories.map((c) => [c._id, c])),
      reload: q.reload,
    };
  }, [q.data, q.loading, q.error, q.reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCatalog phải nằm trong CatalogProvider');
  return v;
}
