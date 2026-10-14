import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminDishRow } from '@/types/api';
import { Badge, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader, Pagination, SearchInput, Tabs, TextArea } from '@/components/ui';
import { adminService } from '@/services';
import { useCatalog } from '@/contexts/CatalogContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce, useDocumentTitle } from '@/hooks/misc';
import { formatDateTime } from '@/utils/format';

export const DISH_STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  draft: { label: 'Nháp', tone: 'warning' },
  published: { label: 'Đã xuất bản', tone: 'success' },
  hidden: { label: 'Đã ẩn', tone: 'danger' },
};

/** UC53–UC56: danh sách món theo trạng thái, xuất bản/ẩn/xóa. */
export function DishesPage() {
  useDocumentTitle('Quản lý món ăn');
  const toast = useToast();
  const catalog = useCatalog();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.dishes({ q: q || undefined, status: status || undefined, page }), [q, status, page]);
  const [hiding, setHiding] = useState<AdminDishRow | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [deleting, setDeleting] = useState<{ row: AdminDishRow; refs: Record<string, number>; canDelete: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      list.reload();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const askDelete = async (row: AdminDishRow) => {
    setBusy(`ref-${row._id}`);
    try {
      const r = await adminService.dishReferences(row._id);
      setDeleting({ row, refs: r.references, canDelete: r.canDelete });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const counts = list.data?.counts ?? {};
  const REF_LABEL: Record<string, string> = { orders: 'đơn hàng', reviews: 'đánh giá', favorites: 'lượt yêu thích', history: 'lịch sử', sellingMenus: 'thực đơn bán', carts: 'giỏ hàng' };
  return (
    <div className="stack">
      <PageHeader title="Món ăn & công thức" description="Món mới luôn ở trạng thái nháp; chỉ món đủ dữ liệu mới xuất bản được." actions={<ButtonLink to="/admin/mon-an/moi" variant="primary" icon="plus">Thêm món</ButtonLink>} />
      <Tabs label="Lọc theo trạng thái" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
        { value: '', label: `Tất cả (${(counts.draft ?? 0) + (counts.published ?? 0) + (counts.hidden ?? 0)})` },
        { value: 'draft', label: `Nháp (${counts.draft ?? 0})` },
        { value: 'published', label: `Đã xuất bản (${counts.published ?? 0})` },
        { value: 'hidden', label: `Đã ẩn (${counts.hidden ?? 0})` },
      ]} />
      <Field label="Tìm theo tên món" labelHidden><SearchInput placeholder="Tìm theo tên món…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Field>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? (
        <EmptyState icon="book" title="Không có món phù hợp" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Món</th><th>Trạng thái</th><th>Buổi ăn</th><th className="num">Nguyên liệu</th><th className="num">Bước</th><th>Cập nhật</th><th className="num">Thao tác</th></tr></thead>
            <tbody>
              {list.data!.items.map((d) => (
                <tr key={d._id}>
                  <td><Link to={`/admin/mon-an/${d._id}`}><strong>{d.name}</strong></Link>{d.selling && <> <Badge tone="primary">Đang bán</Badge></>}<div className="subtle">/{d.slug}</div></td>
                  <td><Badge tone={DISH_STATUS[d.status].tone}>{DISH_STATUS[d.status].label}</Badge></td>
                  <td className="small">{d.mealSlotIds.map((id) => catalog.byId.get(id)?.name ?? '(đã ẩn)').join(', ')}</td>
                  <td className="num">{d.ingredientCount}</td>
                  <td className="num">{d.stepCount}</td>
                  <td className="small nowrap">{formatDateTime(d.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <ButtonLink size="sm" to={`/admin/mon-an/${d._id}`} icon="edit">Sửa</ButtonLink>
                      {d.status !== 'published' && <Button size="sm" variant="accent" loading={busy === `pub-${d._id}`} onClick={() => act(`pub-${d._id}`, () => adminService.publishDish(d._id), `Đã xuất bản “${d.name}”.`)}>Xuất bản</Button>}
                      {d.status === 'published' && <Button size="sm" onClick={() => { setHideReason(''); setHiding(d); }}>Ẩn</Button>}
                      {d.status === 'published' && <Link className="btn btn--ghost btn--sm" to={`/mon/${d.slug}`} target="_blank" rel="noreferrer">Xem</Link>}
                      <Button size="sm" variant="ghost" icon="trash" aria-label={`Xóa ${d.name}`} loading={busy === `ref-${d._id}`} onClick={() => askDelete(d)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}

      <ConfirmDialog open={!!hiding} title={`Ẩn món “${hiding?.name}”?`} confirmLabel="Ẩn món" danger loading={busy === 'hide'}
        message="Món sẽ không còn hiển thị công khai, không xuất hiện trong gợi ý mới và bị tạm ngừng bán. Dữ liệu đơn hàng, đánh giá vẫn được giữ."
        onCancel={() => setHiding(null)}
        onConfirm={async () => { if (hiding && (await act('hide', () => adminService.hideDish(hiding._id, hideReason || undefined), `Đã ẩn “${hiding.name}”.`))) setHiding(null); }}>
        <Field label="Lý do (không bắt buộc)"><TextArea value={hideReason} onChange={(e) => setHideReason(e.target.value)} maxLength={200} /></Field>
      </ConfirmDialog>

      <ConfirmDialog open={!!deleting} title={deleting?.canDelete ? `Xóa vĩnh viễn “${deleting.row.name}”?` : 'Không thể xóa món này'}
        confirmLabel={deleting?.canDelete ? 'Xóa vĩnh viễn' : deleting?.row.status === 'hidden' ? 'Đóng' : 'Ẩn món thay thế'} danger={deleting?.canDelete} loading={busy === 'del'}
        message={deleting?.canDelete ? 'Món chưa được tham chiếu ở đâu. Thao tác không thể hoàn tác.' : `Món đang được tham chiếu: ${Object.entries(deleting?.refs ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${REF_LABEL[k]}`).join(', ')}. Để không mất dữ liệu lịch sử, hãy ẩn món thay vì xóa.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          if (deleting.canDelete) { if (await act('del', () => adminService.deleteDish(deleting.row._id), 'Đã xóa món.')) setDeleting(null); }
          else if (deleting.row.status !== 'hidden') { if (await act('del', () => adminService.hideDish(deleting.row._id, 'Thay cho xóa'), 'Đã ẩn món.')) setDeleting(null); }
          else setDeleting(null);
        }} />
    </div>
  );
}
