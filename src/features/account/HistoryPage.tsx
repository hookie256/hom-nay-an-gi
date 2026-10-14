import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Field, Input, Loading, PageHeader, Pagination, Select } from '@/components/ui';
import { historyService } from '@/services';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { formatDateTime } from '@/utils/format';

const TYPE_LABEL = { view_dish: 'Đã xem món', choose_from_recommendation: 'Chọn từ gợi ý' } as const;

/** UC42–UC43: xem, lọc và xóa lịch sử hoạt động của chính mình. */
export function HistoryPage() {
  useDocumentTitle('Lịch sử hoạt động');
  const toast = useToast();
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery(() => historyService.list({ type: type || undefined, from: from || undefined, to: to || undefined, page }), [type, from, to, page]);
  const [confirm, setConfirm] = useState<{ id?: string; all?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.all) {
        const r = await historyService.clear();
        toast.success(`Đã xóa ${r.deleted} mục lịch sử.`);
      } else if (confirm.id) {
        await historyService.remove(confirm.id);
        toast.success('Đã xóa mục lịch sử.');
      }
      setConfirm(null);
      setPage(1);
      list.reload();
    } catch (e) {
      // Thất bại thì giữ dữ liệu và báo lỗi (UC43)
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hasFilter = type || from || to;
  return (
    <div className="stack">
      <PageHeader title="Lịch sử hoạt động" description="Món bạn đã xem và đã chọn từ gợi ý." actions={list.data && list.data.total > 0 ? <Button variant="danger-outline" icon="trash" onClick={() => setConfirm({ all: true })}>Xóa toàn bộ lịch sử</Button> : undefined} />
      {list.data && !list.data.saveHistory && (
        <Alert tone="info">Bạn đang tắt lưu lịch sử nên hệ thống không ghi hoạt động mới. Có thể bật lại trong <Link to="/tai-khoan/ho-so">Hồ sơ</Link>.</Alert>
      )}
      <div className="form-grid form-grid--3 card card__body">
        <Field label="Loại hoạt động"><Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="view_dish">Đã xem món</option><option value="choose_from_recommendation">Chọn từ gợi ý</option></Select></Field>
        <Field label="Từ ngày"><Input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="Đến ngày"><Input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? (
        <EmptyState icon="history" title={hasFilter ? 'Không có hoạt động phù hợp bộ lọc' : 'Lịch sử đang trống'} action={!hasFilter ? <ButtonLink to="/" variant="primary">Nhận gợi ý món</ButtonLink> : <Button onClick={() => { setType(''); setFrom(''); setTo(''); }}>Xóa bộ lọc</Button>} />
      ) : (
        <ul className="history-list card">
          {list.data!.items.map((h) => (
            <li key={h._id} className="history-item">
              <div>
                {h.dish.available ? <Link to={`/mon/${h.dish.slug}`}><strong>{h.dish.name}</strong></Link> : <strong className="muted">{h.dish.name} <span className="subtle">(không còn khả dụng)</span></strong>}
                <div className="subtle">{TYPE_LABEL[h.eventType]} · {formatDateTime(h.createdAt)}</div>
              </div>
              <Button size="sm" variant="ghost" icon="trash" aria-label={`Xóa mục ${h.dish.name}`} onClick={() => setConfirm({ id: h._id })}>Xóa</Button>
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.all ? 'Xóa toàn bộ lịch sử?' : 'Xóa mục này?'}
        message={confirm?.all ? 'Toàn bộ lịch sử xem món và chọn món sẽ bị xóa và không còn được dùng để cá nhân hóa gợi ý. Thao tác này không thể hoàn tác.' : 'Mục lịch sử sẽ bị xóa và không còn được dùng để cá nhân hóa gợi ý.'}
        confirmLabel="Xóa"
        danger
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
