import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminReviewRow, AdminUserRow, OrderDetail, SellingMenuRow } from '@/types/api';
import type { OrderSettings, OrderStatus, Role, TimeRange } from '@/types/models';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, Stars, Switch, Tabs, TextArea } from '@/components/ui';
import { adminService } from '@/services';
import { ApiRequestError, isMockApi } from '@/services/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce, useDocumentTitle } from '@/hooks/misc';
import { MODERATION_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, ROLE_LABEL } from '@/domain/constants';
import { nextAdminStatuses } from '@/domain/orderStateMachine';
import { formatDateTime, formatPrice } from '@/utils/format';
import { OrderStatusBadge, OrderTimeline, PaymentBadge } from '@/features/orders/OrderBits';

function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(key: string, fn: () => Promise<T>, ok?: string, onErr?: (e: ApiRequestError) => void): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      if (e instanceof ApiRequestError && onErr) onErr(e);
      toast.error((e as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

// ======================= Kiểm duyệt đánh giá (UC71–UC73) =======================
export function ReviewsAdminPage() {
  useDocumentTitle('Kiểm duyệt đánh giá');
  const [tab, setTab] = useState<'reviews' | 'reports'>('reviews');
  return (
    <div className="stack">
      <PageHeader title="Kiểm duyệt đánh giá" description="Chỉ đánh giá ở trạng thái công khai mới hiển thị và được tính điểm trung bình." />
      <Tabs label="Kiểm duyệt" value={tab} onChange={setTab} tabs={[{ value: 'reviews', label: 'Đánh giá' }, { value: 'reports', label: 'Báo cáo vi phạm' }]} />
      {tab === 'reviews' ? <ReviewList /> : <ReportList />}
    </div>
  );
}

function ReviewList() {
  const [status, setStatus] = useState('pending');
  const [dish, setDish] = useState('');
  const dq = useDebounce(dish, 300);
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.reviews({ status: status || undefined, dish: dq || undefined, page }), [status, dq, page]);
  const [hiding, setHiding] = useState<AdminReviewRow | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();
  const { busy, run } = useRun();
  const stale = (e: ApiRequestError) => e.code === 'STALE_STATE' && list.reload();
  return (
    <div className="stack">
      <div className="form-grid form-grid--2 card card__body">
        <Field label="Trạng thái"><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="pending">Chờ duyệt</option><option value="published">Công khai</option><option value="hidden">Đã ẩn</option></Select></Field>
        <Field label="Món"><SearchInput placeholder="Tên món…" value={dish} onChange={(e) => { setDish(e.target.value); setPage(1); }} /></Field>
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="message" title="Không có đánh giá phù hợp" /> : (
        <ul className="stack">{list.data!.items.map((r) => (
          <li key={r._id} className="card card__body stack-sm">
            <div className="row-between">
              <div className="row"><strong>{r.dishName}</strong><Stars value={r.rating} /><Badge tone={r.moderationStatus === 'published' ? 'success' : r.moderationStatus === 'pending' ? 'warning' : 'danger'}>{MODERATION_LABEL[r.moderationStatus]}</Badge>{r.openReports > 0 && <Badge tone="danger" icon="flag">{r.openReports} báo cáo</Badge>}</div>
              <span className="subtle">{r.authorEmail} · {formatDateTime(r.updatedAt)}</span>
            </div>
            <p style={{ margin: 0 }}>{r.body || <span className="muted">(Không có nội dung)</span>}</p>
            {r.moderationReason && <p className="subtle" style={{ margin: 0 }}>Lý do xử lý trước: {r.moderationReason}</p>}
            <div className="row">
              {r.moderationStatus !== 'published' && <Button size="sm" variant="accent" icon="check" loading={busy === `ok-${r._id}`} onClick={async () => { if (await run(`ok-${r._id}`, () => adminService.moderateReview(r._id, 'published', undefined, r.moderationStatus), 'Đã duyệt đánh giá.', stale)) list.reload(); }}>Duyệt</Button>}
              {r.moderationStatus !== 'hidden' && <Button size="sm" variant="danger-outline" icon="eyeOff" onClick={() => { setReason(''); setReasonErr(undefined); setHiding(r); }}>Ẩn</Button>}
            </div>
          </li>
        ))}</ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      <ConfirmDialog open={!!hiding} title="Ẩn đánh giá" confirmLabel="Ẩn" danger loading={busy === 'hide'} onCancel={() => setHiding(null)}
        onConfirm={async () => { if (!reason.trim()) return setReasonErr('Vui lòng ghi lý do ẩn.'); if (hiding && (await run('hide', () => adminService.moderateReview(hiding._id, 'hidden', reason.trim(), hiding.moderationStatus), 'Đã ẩn đánh giá.', stale))) { setHiding(null); list.reload(); } }}>
        <Field label="Lý do" required error={reasonErr}><TextArea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} data-autofocus /></Field>
      </ConfirmDialog>
    </div>
  );
}

function ReportList() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.reports({ status, page }), [status, page]);
  const [deciding, setDeciding] = useState<{ id: string; decision: 'keep' | 'hide' } | null>(null);
  const [note, setNote] = useState('');
  const { busy, run } = useRun();
  return (
    <div className="stack">
      <Field label="Trạng thái"><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 260 }}><option value="open">Đang chờ xử lý</option><option value="resolved">Đã ẩn nhận xét</option><option value="rejected">Đã giữ nhận xét</option><option value="all">Tất cả</option></Select></Field>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="flag" title="Không có báo cáo" /> : (
        <ul className="stack">{list.data!.items.map((r) => (
          <li key={r._id} className="card card__body stack-sm">
            <div className="row-between"><div className="row"><Badge tone="danger" icon="flag">{r.reason}</Badge>{r.status !== 'open' && <Badge>{r.resolution === 'hidden' ? 'Đã ẩn nhận xét' : 'Giữ nhận xét'}</Badge>}</div><span className="subtle">Người báo cáo: {r.reporterEmail} · {formatDateTime(r.createdAt)}</span></div>
            {r.review ? (
              <blockquote className="quote"><div className="row small"><strong>{r.review.dishName}</strong><Stars value={r.review.rating} /><Badge>{MODERATION_LABEL[r.review.moderationStatus]}</Badge></div>{r.review.body}</blockquote>
            ) : <p className="muted">Nhận xét đã bị xóa.</p>}
            {r.status === 'open' ? (
              <div className="row">
                <Button size="sm" onClick={() => { setNote(''); setDeciding({ id: r._id, decision: 'keep' }); }}>Giữ nhận xét</Button>
                <Button size="sm" variant="danger" onClick={() => { setNote(''); setDeciding({ id: r._id, decision: 'hide' }); }}>Ẩn nhận xét</Button>
              </div>
            ) : <p className="subtle" style={{ margin: 0 }}>Xử lý bởi {r.resolvedByEmail} lúc {r.resolvedAt ? formatDateTime(r.resolvedAt) : ''}</p>}
          </li>
        ))}</ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      <ConfirmDialog open={!!deciding} title={deciding?.decision === 'hide' ? 'Ẩn nhận xét bị báo cáo?' : 'Giữ nhận xét?'} confirmLabel="Xác nhận" danger={deciding?.decision === 'hide'} loading={busy === 'res'}
        message="Báo cáo sẽ được đóng kèm kết quả, người xử lý và thời điểm xử lý." onCancel={() => setDeciding(null)}
        onConfirm={async () => { if (deciding && (await run('res', () => adminService.resolveReport(deciding.id, deciding.decision, note.trim() || undefined), 'Đã xử lý báo cáo.', (e) => e.code === 'ALREADY_RESOLVED' && list.reload()))) { setDeciding(null); list.reload(); } }}>
        <Field label="Ghi chú (không bắt buộc)"><TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
      </ConfirmDialog>
    </div>
  );
}

// ======================= Thực đơn bán hàng (UC77–UC79) =======================
function HoursEditor({ value, onChange, error }: { value: TimeRange[]; onChange: (v: TimeRange[]) => void; error?: string }) {
  return (
    <div className="stack-sm">
      {value.map((r, i) => (
        <div key={i} className="row">
          <Input type="time" value={r.start} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} aria-label={`Giờ bắt đầu khung ${i + 1}`} style={{ width: 140 }} />
          <span>–</span>
          <Input type="time" value={r.end} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} aria-label={`Giờ kết thúc khung ${i + 1}`} style={{ width: 140 }} />
          <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Xóa khung ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div><Button size="sm" icon="plus" onClick={() => onChange([...value, { start: '07:00', end: '21:00' }])}>Thêm khung giờ</Button></div>
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

export function SellingAdminPage() {
  useDocumentTitle('Thực đơn bán hàng');
  const list = useQuery(() => adminService.sellingMenus(), []);
  const [editing, setEditing] = useState<SellingMenuRow | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removing, setRemoving] = useState<SellingMenuRow | null>(null);
  const { busy, run } = useRun();
  const s = list.data?.settings;
  return (
    <div className="stack">
      <PageHeader title="Thực đơn bán hàng" description="Món có công thức không mặc nhiên được bán. Giá mới chỉ áp dụng cho đơn tạo sau thời điểm thay đổi." actions={<><Button icon="clock" onClick={() => setSettingsOpen(true)}>Thời gian nhận đơn</Button><Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Bật bán món</Button></>} />
      {s && <Alert tone="info">Giờ nhận đơn mặc định: <strong>{s.defaultReceivingHours.map((h) => `${h.start}–${h.end}`).join(', ')}</strong> ({s.timezone}). Tối đa {s.maxQuantityPerItem} phần mỗi món trong một đơn.</Alert>}
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="store" title="Chưa có món nào được bán" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Món</th><th className="num">Giá</th><th>Còn bán</th><th>Giờ nhận đơn</th><th>Hiện tại</th><th className="num">Thao tác</th></tr></thead>
          <tbody>{list.data!.items.map((m) => (
            <tr key={m._id}>
              <td><strong>{m.dishName}</strong>{m.dishStatus !== 'published' && <> <Badge tone="danger">Món {m.dishStatus === 'hidden' ? 'đã ẩn' : 'nháp'}</Badge></>}</td>
              <td className="num">{formatPrice(m.price)}</td>
              <td><Switch label={m.available ? 'Đang bán' : 'Tạm ngừng'} checked={m.available} disabled={busy === `av-${m._id}`} onChange={async (e) => { if (await run(`av-${m._id}`, () => adminService.updateSelling(m._id, { available: e.target.checked }), e.target.checked ? 'Đã mở bán lại.' : 'Đã tạm ngừng bán.')) list.reload(); }} /></td>
              <td className="small">{m.receivingHours?.length ? m.receivingHours.map((h) => `${h.start}–${h.end}`).join(', ') : <span className="muted">Mặc định</span>}</td>
              <td>{m.orderableNow ? <Badge tone="success">Nhận đơn</Badge> : <span className="small muted">{m.reason}</span>}</td>
              <td><div className="table-actions"><Button size="sm" icon="edit" onClick={() => setEditing(m)}>Sửa</Button><Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>Gỡ khỏi thực đơn</Button></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {editing && <SellingForm menu={editing === 'new' ? null : editing} existing={list.data?.items ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      {settingsOpen && s && <OrderSettingsForm settings={s} onClose={() => setSettingsOpen(false)} onSaved={() => { setSettingsOpen(false); list.reload(); }} />}
      <ConfirmDialog open={!!removing} title={`Gỡ “${removing?.dishName}” khỏi thực đơn bán?`} confirmLabel="Gỡ" danger loading={busy === 'rm'} message="Món vẫn giữ công thức và hiển thị công khai nhưng không thể đặt. Các đơn đã tạo không thay đổi." onCancel={() => setRemoving(null)}
        onConfirm={async () => { if (removing && (await run('rm', () => adminService.disableSelling(removing._id), 'Đã gỡ món khỏi thực đơn bán.'))) { setRemoving(null); list.reload(); } }} />
    </div>
  );
}

function SellingForm({ menu, existing, onClose, onSaved }: { menu: SellingMenuRow | null; existing: SellingMenuRow[]; onClose: () => void; onSaved: () => void }) {
  const dishes = useQuery(() => adminService.dishes({ status: 'published', page: 1 }).then(async (first) => {
    const pages = Math.ceil(first.total / first.pageSize);
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => adminService.dishes({ status: 'published', page: i + 2 })));
    return [first, ...rest].flatMap((p) => p.items);
  }), [], { enabled: !menu });
  const [dishId, setDishId] = useState(menu?.dishId ?? '');
  const [price, setPrice] = useState(menu ? String(menu.price) : '');
  const [available, setAvailable] = useState(menu?.available ?? true);
  const [customHours, setCustomHours] = useState(!!menu?.receivingHours?.length);
  const [hours, setHours] = useState<TimeRange[]>(menu?.receivingHours?.length ? menu.receivingHours : [{ start: '10:00', end: '14:00' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const { busy, run } = useRun();
  const priceNum = Number(price);
  const priceChanged = menu && priceNum !== menu.price;

  const validate = () => {
    const fe: Record<string, string> = {};
    if (!menu && !dishId) fe.dishId = 'Chọn món đã xuất bản.';
    if (!Number.isInteger(priceNum) || priceNum <= 0) fe.price = 'Giá phải là số nguyên dương (đồng).';
    setErrors(fe);
    return Object.keys(fe).length === 0;
  };
  const save = async () => {
    const body = { price: priceNum, available, receivingHours: customHours ? hours : [] };
    const r = await run('save', () => (menu ? adminService.updateSelling(menu._id, body) : adminService.enableSelling({ dishId, ...body })), menu ? 'Đã cập nhật thông tin bán.' : 'Đã bật bán món.', (e) => e.fieldErrors && setErrors(e.fieldErrors));
    if (r) onSaved();
    else setConfirming(false);
  };
  const options = (dishes.data ?? []).filter((d) => !existing.some((e) => e.dishId === d._id));
  return (
    <Modal open onClose={onClose} title={menu ? `Sửa: ${menu.dishName}` : 'Bật bán món'} closeDisabled={!!busy} footer={
      confirming ? (
        <><Button onClick={() => setConfirming(false)}>Quay lại</Button><Button variant="primary" onClick={save} loading={busy === 'save'}>Xác nhận áp dụng</Button></>
      ) : (
        <><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={() => validate() && setConfirming(true)}>Xem trước</Button></>
      )
    }>
      {confirming ? (
        <div className="stack">
          <h3 className="h4">Thông tin sắp áp dụng</h3>
          <dl className="dl">
            <dt>Món</dt><dd>{menu?.dishName ?? options.find((d) => d._id === dishId)?.name}</dd>
            <dt>Giá</dt><dd>{menu && priceChanged ? <><s>{formatPrice(menu.price)}</s> → </> : null}{formatPrice(priceNum)}</dd>
            <dt>Trạng thái</dt><dd>{available ? 'Đang bán' : 'Tạm ngừng'}</dd>
            <dt>Giờ nhận đơn</dt><dd>{customHours ? hours.map((h) => `${h.start}–${h.end}`).join(', ') : 'Theo giờ mặc định'}</dd>
          </dl>
          {priceChanged && <Alert tone="warning">Giá mới chỉ áp dụng cho đơn tạo sau thời điểm này. Các đơn đã tạo giữ nguyên đơn giá lúc đặt; giỏ hàng đang có món sẽ được yêu cầu xác nhận giá mới.</Alert>}
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (validate()) setConfirming(true); }}>
          {!menu && (
            <Field label="Món (đã xuất bản)" required error={errors.dishId}>
              <Select value={dishId} onChange={(e) => setDishId(e.target.value)} disabled={dishes.loading}>
                <option value="">{dishes.loading ? 'Đang tải…' : '– Chọn món –'}</option>
                {options.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Giá bán (đồng)" required error={errors.price}><Input type="number" min={1000} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Switch label="Còn nhận đặt" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          <Switch label="Dùng khung giờ riêng cho món này" checked={customHours} onChange={(e) => setCustomHours(e.target.checked)} />
          {customHours && <HoursEditor value={hours} onChange={setHours} error={errors.receivingHours} />}
        </form>
      )}
    </Modal>
  );
}

function OrderSettingsForm({ settings, onClose, onSaved }: { settings: OrderSettings; onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState(settings.defaultReceivingHours);
  const [tz, setTz] = useState(settings.timezone);
  const [max, setMax] = useState(String(settings.maxQuantityPerItem));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useRun();
  const save = async () => {
    if (await run('save', () => adminService.updateOrderSettings({ defaultReceivingHours: hours, timezone: tz, maxQuantityPerItem: Number(max) }), 'Đã lưu thời gian nhận đơn.', (e) => e.fieldErrors && setErrors(e.fieldErrors))) onSaved();
  };
  return (
    <Modal open onClose={onClose} title="Thời gian nhận đơn (UC79)" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={save} loading={busy === 'save'}>Lưu</Button></>}>
      <div className="stack">
        <Field label="Múi giờ" error={errors.timezone} hint="Ví dụ: Asia/Ho_Chi_Minh"><Input value={tz} onChange={(e) => setTz(e.target.value)} /></Field>
        <div><span className="field__label">Khung giờ mặc định</span><HoursEditor value={hours} onChange={setHours} error={errors.receivingHours} /></div>
        <Field label="Số phần tối đa mỗi món trong một đơn" error={errors.maxQuantityPerItem}><Input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} style={{ maxWidth: 160 }} /></Field>
        <p className="subtle">Yêu cầu đặt món ngoài khung giờ sẽ bị từ chối kèm giải thích.</p>
      </div>
    </Modal>
  );
}

// ======================= Đơn hàng (UC80–UC83) =======================
export function OrdersAdminPage() {
  useDocumentTitle('Quản lý đơn hàng');
  const [group, setGroup] = useState<'new' | 'processing' | 'done'>('new');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.orders({ group, q: q || undefined, page }), [group, q, page]);
  const [openId, setOpenId] = useState<string | null>(null);
  const c = list.data?.counts ?? {};
  return (
    <div className="stack">
      <PageHeader title="Đơn hàng" description="Xử lý đơn theo trình tự: chờ xác nhận → đã xác nhận → đang chuẩn bị → hoàn thành." actions={<Button icon="refresh" onClick={list.reload} loading={list.loading}>Làm mới</Button>} />
      {list.data && list.data.cancelRequests > 0 && <Alert tone="warning">Có {list.data.cancelRequests} đơn đang chờ xử lý yêu cầu hủy.</Alert>}
      <Tabs label="Nhóm đơn" value={group} onChange={(g) => { setGroup(g); setPage(1); }} tabs={[{ value: 'new', label: `Đơn mới (${c.new ?? 0})` }, { value: 'processing', label: `Đang xử lý (${c.processing ?? 0})` }, { value: 'done', label: `Đã kết thúc (${c.done ?? 0})` }]} />
      <Field label="Tìm mã đơn" labelHidden><SearchInput placeholder="Tìm theo mã đơn, ví dụ HNAG-103" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Field>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="package" title="Không có đơn trong nhóm này" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Mã đơn</th><th>Khách</th><th>Món</th><th className="num">Tổng</th><th>Trạng thái</th><th>Thanh toán</th><th>Đặt lúc</th><th className="num"></th></tr></thead>
          <tbody>{list.data!.items.map((o) => (
            <tr key={o._id}>
              <td><strong className="code">{o.code}</strong>{o.cancelRequest?.status === 'pending' && <div><Badge tone="warning">Yêu cầu hủy</Badge></div>}</td>
              <td className="small">{o.receiveInfo.receiverName}<div className="subtle">{o.userEmail}</div></td>
              <td className="small">{o.items.map((i) => `${i.snapshotName} × ${i.quantity}`).join(', ')}</td>
              <td className="num">{formatPrice(o.total)}</td>
              <td><OrderStatusBadge status={o.orderStatus} /></td>
              <td><PaymentBadge status={o.paymentStatus} /></td>
              <td className="small nowrap">{formatDateTime(o.createdAt)}</td>
              <td><Button size="sm" variant="primary" onClick={() => setOpenId(o._id)}>Xử lý</Button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      {openId && <OrderAdminDialog id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </div>
  );
}

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = { confirmed: 'Xác nhận đơn', rejected: 'Từ chối', preparing: 'Bắt đầu chuẩn bị', completed: 'Hoàn thành' };

function OrderAdminDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const q = useQuery(() => adminService.order(id), [id]);
  const { busy, run } = useRun();
  const [reasonFor, setReasonFor] = useState<'rejected' | 'approve' | 'reject-cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState<string>();
  const o = q.data;
  const apply = (d: OrderDetail | undefined) => { if (d) { q.setData(d); onChanged(); setReasonFor(null); } };
  // Đơn đã bị người khác cập nhật → tải lại, không ghi đè
  const onErr = (e: ApiRequestError) => (e.code === 'STALE_STATE' || e.code === 'INVALID_TRANSITION') && q.reload();

  const transition = async (to: OrderStatus, why?: string) => o && apply(await run(`st-${to}`, () => adminService.setOrderStatus(o._id, to, o.orderStatus, why), `Đơn đã chuyển sang “${ORDER_STATUS_LABEL[to]}”.`, onErr));
  const submitReason = async () => {
    if (!reason.trim()) return setReasonErr('Vui lòng nhập lý do.');
    if (!o) return;
    if (reasonFor === 'rejected') return transition('rejected', reason.trim());
    apply(await run('cancel', () => adminService.decideCancel(o._id, reasonFor === 'approve' ? 'approve' : 'reject', reason.trim()), reasonFor === 'approve' ? 'Đã chấp nhận yêu cầu hủy.' : 'Đã từ chối yêu cầu hủy.', onErr));
  };

  return (
    <Modal open onClose={onClose} size="lg" title={o ? <>Đơn <span className="code">{o.code}</span></> : 'Đơn hàng'}>
      {q.loading && !o ? <Loading /> : q.error ? <ErrorState message={q.error.message} onRetry={q.reload} /> : o && (
        <div className="stack">
          <div className="row"><OrderStatusBadge status={o.orderStatus} /><PaymentBadge status={o.paymentStatus} /><span className="subtle">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span></div>
          {o.cancelRequest?.status === 'pending' && (
            <Alert tone="warning" title="Người đặt yêu cầu hủy đơn" action={<div className="stack-sm"><Button size="sm" variant="danger" onClick={() => { setReason(''); setReasonErr(undefined); setReasonFor('approve'); }}>Chấp nhận hủy</Button><Button size="sm" onClick={() => { setReason(''); setReasonErr(undefined); setReasonFor('reject-cancel'); }}>Từ chối hủy</Button></div>}>
              Lý do: {o.cancelRequest.reason}{o.paymentStatus === 'paid' && <><br />Đơn đã thanh toán: nếu chấp nhận, trạng thái thanh toán chuyển sang chờ hoàn tiền.</>}
            </Alert>
          )}
          <div className="grid-2">
            <div className="stack-sm">
              <h3 className="h4">Món</h3>
              <ul className="summary-list">{o.items.map((i) => <li key={i.dishId} className="row-between small"><span>{i.snapshotName} × {i.quantity}</span><span>{formatPrice(i.lineTotal)}</span></li>)}</ul>
              <div className="row-between"><strong>Tổng</strong><strong>{formatPrice(o.total)}</strong></div>
              <h3 className="h4">Nhận món</h3>
              <dl className="dl"><dt>Người nhận</dt><dd>{o.receiveInfo.receiverName}</dd><dt>Điện thoại</dt><dd><a href={`tel:${o.receiveInfo.phone}`}>{o.receiveInfo.phone}</a></dd><dt>Hình thức</dt><dd>{o.receiveInfo.method === 'delivery' ? `Giao: ${o.receiveInfo.address}` : 'Tự đến lấy'}</dd>{o.receiveInfo.note && <><dt>Ghi chú</dt><dd>{o.receiveInfo.note}</dd></>}<dt>Tài khoản</dt><dd>{o.userEmail}</dd></dl>
            </div>
            <div className="stack-sm"><h3 className="h4">Lịch sử trạng thái</h3><OrderTimeline events={o.events} /></div>
          </div>
          {reasonFor ? (
            <div className="card card__body stack">
              <Field label={reasonFor === 'rejected' ? 'Lý do từ chối (sẽ báo cho người đặt)' : 'Lý do'} required error={reasonErr}><TextArea value={reason} onChange={(e) => { setReason(e.target.value); setReasonErr(undefined); }} maxLength={300} /></Field>
              {reasonFor === 'rejected' && o.paymentStatus === 'paid' && <Alert tone="warning">Đơn đã thanh toán: trạng thái thanh toán sẽ chuyển sang chờ hoàn tiền.</Alert>}
              <div className="form-actions"><Button onClick={() => setReasonFor(null)}>Hủy</Button><Button variant="danger" onClick={submitReason} loading={busy === 'st-rejected' || busy === 'cancel'}>Xác nhận</Button></div>
            </div>
          ) : (
            <div className="form-actions">
              {nextAdminStatuses(o.orderStatus).map((to) => to === 'rejected' ? (
                <Button key={to} variant="danger-outline" onClick={() => { setReason(''); setReasonErr(undefined); setReasonFor('rejected'); }}>Từ chối</Button>
              ) : (
                <Button key={to} variant="primary" onClick={() => transition(to)} loading={busy === `st-${to}`} disabled={(to === 'preparing' && o.cancelRequest?.status === 'pending') || !!busy}>{ACTION_LABEL[to]}</Button>
              ))}
              {o.paymentMethod === 'cod' && o.paymentStatus === 'unpaid' && !['rejected', 'cancelled'].includes(o.orderStatus) && (
                <Button icon="check" onClick={async () => apply(await run('pay', () => adminService.setPayment(o._id, 'paid'), 'Đã ghi nhận thu tiền.'))} loading={busy === 'pay'}>Ghi nhận đã thu tiền</Button>
              )}
              {o.paymentStatus === 'refund_pending' && <Button onClick={async () => apply(await run('ref', () => adminService.setPayment(o._id, 'refunded'), 'Đã ghi nhận hoàn tiền.'))} loading={busy === 'ref'}>Ghi nhận đã hoàn tiền</Button>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ======================= Tài khoản (UC67–UC69) =======================
export function UsersAdminPage() {
  useDocumentTitle('Quản lý tài khoản');
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.users({ q: q || undefined, role: role || undefined, status: status || undefined, page }), [q, role, status, page]);
  const [action, setAction] = useState<{ user: AdminUserRow; kind: 'lock' | 'unlock' | 'role' } | null>(null);
  const [reason, setReason] = useState('');
  const [newRole, setNewRole] = useState<Role>('user');
  const [err, setErr] = useState<string>();
  const { busy, run } = useRun();
  const isSuper = me?.role === 'super_admin';

  const submit = async () => {
    if (!action) return;
    if (!reason.trim()) return setErr('Vui lòng nhập lý do.');
    const u = action.user;
    const ok = action.kind === 'role'
      ? await run('act', () => adminService.setUserRole(u._id, newRole, reason.trim()), 'Đã cập nhật vai trò. Hiệu lực từ yêu cầu tiếp theo.')
      : await run('act', () => adminService.setUserStatus(u._id, action.kind === 'lock' ? 'locked' : 'active', reason.trim(), u.status), action.kind === 'lock' ? 'Đã khóa tài khoản và thu hồi các phiên đăng nhập.' : 'Đã mở khóa tài khoản.', (e) => e.code === 'STALE_STATE' && list.reload());
    if (ok) { setAction(null); list.reload(); }
  };

  return (
    <div className="stack">
      <PageHeader title="Tài khoản" description="Danh sách chỉ hiển thị thông tin cần cho quản trị; không hiển thị mật khẩu hay mã phiên." />
      <div className="form-grid form-grid--3 card card__body">
        <Field label="Tìm kiếm"><SearchInput placeholder="Email hoặc tên…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Field>
        <Field label="Vai trò"><Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">Tất cả</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        <Field label="Trạng thái"><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="active">Hoạt động</option><option value="locked">Bị khóa</option></Select></Field>
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="users" title="Không có tài khoản phù hợp" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Email</th><th>Tên</th><th>Vai trò</th><th>Trạng thái</th><th>Tạo lúc</th><th className="num">Thao tác</th></tr></thead>
          <tbody>{list.data!.items.map((u) => {
            const self = u._id === me?._id;
            const canLock = !self && (u.role === 'user' || isSuper);
            return (
              <tr key={u._id}>
                <td>{u.email}{self && <span className="subtle"> (bạn)</span>}</td>
                <td>{u.displayName ?? '—'}</td>
                <td><Badge tone={u.role === 'user' ? undefined : 'info'}>{ROLE_LABEL[u.role]}</Badge></td>
                <td>{u.status === 'active' ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="danger">Bị khóa</Badge>}</td>
                <td className="small nowrap">{formatDateTime(u.createdAt)}</td>
                <td><div className="table-actions">
                  {canLock && <Button size="sm" variant={u.status === 'active' ? 'danger-outline' : 'secondary'} onClick={() => { setReason(''); setErr(undefined); setAction({ user: u, kind: u.status === 'active' ? 'lock' : 'unlock' }); }}>{u.status === 'active' ? 'Khóa' : 'Mở khóa'}</Button>}
                  {isSuper && !self && <Button size="sm" icon="shield" onClick={() => { setReason(''); setErr(undefined); setNewRole(u.role); setAction({ user: u, kind: 'role' }); }}>Phân quyền</Button>}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      <ConfirmDialog open={!!action} loading={busy === 'act'} danger={action?.kind === 'lock'} onCancel={() => setAction(null)} onConfirm={submit}
        title={action?.kind === 'lock' ? 'Khóa tài khoản?' : action?.kind === 'unlock' ? 'Mở khóa tài khoản?' : 'Phân quyền tài khoản'}
        confirmLabel={action?.kind === 'lock' ? 'Khóa tài khoản' : action?.kind === 'unlock' ? 'Mở khóa' : 'Cập nhật vai trò'}
        message={<>Tài khoản bị tác động: <strong>{action?.user.email}</strong>. {action?.kind === 'lock' ? 'Người dùng sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được.' : action?.kind === 'unlock' ? 'Người dùng đăng nhập lại được; các phiên cũ không được khôi phục.' : 'Chỉ quản trị viên cấp cao được cấp hoặc thu hồi quyền quản trị.'} Thao tác được ghi vào lịch sử quản trị.</>}>
        <div className="stack" style={{ marginTop: 12 }}>
          {action?.kind === 'role' && <Field label="Vai trò mới"><Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>}
          <Field label="Lý do" required error={err}><TextArea value={reason} onChange={(e) => { setReason(e.target.value); setErr(undefined); }} maxLength={200} /></Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ======================= Lịch sử quản trị (UC70) =======================
export function AuditAdminPage() {
  useDocumentTitle('Lịch sử quản trị');
  const [actor, setActor] = useState('');
  const aq = useDebounce(actor, 300);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.auditLogs({ actor: aq || undefined, action: action || undefined, targetType: targetType || undefined, from: from || undefined, to: to || undefined, page }), [aq, action, targetType, from, to, page]);
  const fmt = (o?: Record<string, unknown>) => (o ? Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('; ') : '—');
  return (
    <div className="stack">
      <PageHeader title="Lịch sử quản trị" description="Ghi lại người thực hiện, thời điểm, loại thao tác và đối tượng bị tác động. Không chứa mật khẩu hoặc mã phiên." />
      <div className="form-grid card card__body" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Field label="Người thực hiện"><Input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="email…" /></Field>
        <Field label="Thao tác"><Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">Tất cả</option>{list.data?.actions.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
        <Field label="Đối tượng"><Select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}><option value="">Tất cả</option>{['user', 'dish', 'ingredient', 'unit', 'category', 'selling_menu', 'order', 'review', 'settings'].map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Từ ngày"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="Đến ngày"><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState icon="shield" title="Không có thao tác phù hợp" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Trước</th><th>Sau</th><th>Lý do</th></tr></thead>
          <tbody>{list.data!.items.map((l) => (
            <tr key={l._id}><td className="small nowrap">{formatDateTime(l.createdAt)}</td><td className="small">{l.actorEmail}</td><td><code>{l.action}</code></td><td className="small">{l.targetType} · <code>{l.targetId.slice(0, 12)}</code></td><td className="small audit-cell">{fmt(l.before)}</td><td className="small audit-cell">{fmt(l.after)}</td><td className="small">{l.reason ?? '—'}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
    </div>
  );
}

// ======================= Sao lưu / khôi phục dữ liệu thử (NFR15) =======================
export function DataAdminPage() {
  useDocumentTitle('Sao lưu dữ liệu');
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!isMockApi) return <EmptyState icon="download" title="Chỉ có ở chế độ chạy thử">Với backend thật, sao lưu và khôi phục MongoDB được thực hiện ở máy chủ (mongodump/mongorestore).</EmptyState>;
  const download = async () => {
    const { exportDb } = await import('@/mock-server');
    const blob = new Blob([exportDb()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hom-nay-an-gi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const restore = async (file: File) => {
    try {
      const { importDb } = await import('@/mock-server');
      importDb(await file.text());
      toast.success('Đã khôi phục dữ liệu. Trang sẽ tải lại.');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(`Không khôi phục được: ${(e as Error).message}`);
    }
  };
  return (
    <div className="stack">
      <PageHeader title="Sao lưu & khôi phục dữ liệu thử" description="Dữ liệu chế độ chạy thử được lưu trong trình duyệt này." />
      <Alert tone="warning">Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại trong trình duyệt, bao gồm tài khoản, món, đơn hàng.</Alert>
      <div className="row">
        <Button icon="download" onClick={download}>Tải bản sao lưu (.json)</Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>Khôi phục từ tệp…</Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        <Button variant="danger-outline" icon="refresh" onClick={() => setConfirmReset(true)}>Khôi phục dữ liệu mẫu ban đầu</Button>
      </div>
      <p className="subtle"><Icon name="info" size={14} /> Tài khoản thử sau khi khôi phục dữ liệu mẫu: xem README. <Link to="/admin">Về thống kê</Link></p>
      <ConfirmDialog open={confirmReset} title="Khôi phục dữ liệu mẫu?" danger confirmLabel="Khôi phục" loading={busy} message="Mọi thay đổi sẽ mất và bạn sẽ bị đăng xuất." onCancel={() => setConfirmReset(false)}
        onConfirm={async () => { setBusy(true); const { resetDb } = await import('@/mock-server'); await resetDb(); try { localStorage.removeItem('hnag-token'); } catch { /* bỏ qua */ } window.location.href = '/'; }} />
    </div>
  );
}
