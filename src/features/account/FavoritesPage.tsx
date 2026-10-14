import { useState } from 'react';
import { Button, ButtonLink, CardSkeletonGrid, EmptyState, ErrorState, Field, PageHeader, Pagination, SearchInput } from '@/components/ui';
import { DishCard } from '@/components/dish/DishCard';
import { favoriteService } from '@/services';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce, useDocumentTitle } from '@/hooks/misc';

/** UC36: xem và tìm món yêu thích; món đã ẩn báo không khả dụng và cho bỏ lưu. */
export function FavoritesPage() {
  useDocumentTitle('Món yêu thích');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const list = useQuery(() => favoriteService.list(q || undefined, page), [q, page]);

  const removeHidden = async (dishId: string, name: string) => {
    try {
      await favoriteService.remove(dishId);
      toast.success(`Đã bỏ lưu “${name}”.`);
      list.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <PageHeader title="Món yêu thích" description="Những món bạn đã lưu để xem lại." />
      <Field label="Tìm trong danh sách yêu thích" labelHidden>
        <SearchInput placeholder="Tìm theo tên món…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </Field>
      {list.loading && !list.data ? <CardSkeletonGrid count={3} /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? (
        q ? <EmptyState title={`Không có món yêu thích nào khớp “${q}”`}>Hãy thử từ khóa khác.</EmptyState> : (
          <EmptyState icon="heart" title="Bạn chưa lưu món nào" action={<ButtonLink to="/kham-pha" variant="primary">Khám phá món ăn</ButtonLink>}>
            Nhấn biểu tượng trái tim trên thẻ món hoặc trang chi tiết để lưu.
          </EmptyState>
        )
      ) : (
        <div className="grid-cards">
          {list.data!.items.map((f) => f.dish ? (
            <DishCard key={f.dishId} dish={f.dish} />
          ) : (
            <article key={f.dishId} className="card card__body stack-sm unavailable-card">
              <strong>{f.name}</strong>
              <p className="muted small" style={{ margin: 0 }}>Món này không còn khả dụng trên trang công khai.</p>
              <Button size="sm" variant="danger-outline" icon="trash" onClick={() => removeHidden(f.dishId, f.name)}>Bỏ lưu</Button>
            </article>
          ))}
        </div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
    </div>
  );
}
