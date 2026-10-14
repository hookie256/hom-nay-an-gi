import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { DishDetail, MyReview } from '@/types/api';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, Pagination, RatingInput, Select, Stars, TextArea, Loading } from '@/components/ui';
import { catalogService, reviewService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { MODERATION_LABEL, REVIEW_REPORT_REASONS } from '@/domain/constants';
import { relativeTime } from '@/utils/format';
import { ApiRequestError } from '@/services/apiClient';

/** UC37–UC40: xem, gửi, sửa/xóa đánh giá của mình, báo cáo nhận xét vi phạm. */
export function ReviewsSection({ dish, onRatingChanged }: { dish: DishDetail; onRatingChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const list = useQuery(() => catalogService.reviews(dish._id, page), [dish._id, page]);
  const mine = useQuery(() => reviewService.mine(dish._id), [dish._id, user?._id], { enabled: user?.role === 'user' });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  const myReview = mine.data?.review ?? null;
  const refresh = () => { list.reload(); mine.reload(); onRatingChanged(); };

  const remove = async () => {
    if (!myReview) return;
    setBusy(true);
    try {
      await reviewService.remove(myReview._id);
      toast.success('Đã xóa đánh giá của bạn.');
      setDeleting(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card__body stack" aria-labelledby="reviews-title" id="danh-gia">
      <div className="row-between">
        <div>
          <h2 id="reviews-title" className="h3" style={{ marginBottom: 4 }}>Đánh giá</h2>
          {dish.rating ? (
            <div className="row"><span className="rating-big">{dish.rating.avg.toLocaleString('vi-VN')}</span><Stars value={dish.rating.avg} size={18} /><span className="muted small">{dish.rating.count} đánh giá công khai</span></div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Chưa có đánh giá</p>
          )}
        </div>
        {!user ? (
          <Link className="btn" to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`}>Đăng nhập để đánh giá</Link>
        ) : user.role === 'user' && !mine.loading && !myReview ? (
          <Button variant="primary" icon="star" onClick={() => setEditing(true)}>Viết đánh giá</Button>
        ) : null}
      </div>

      {myReview && (
        <div className="my-review">
          <div className="row-between">
            <div className="row"><strong>Đánh giá của bạn</strong><Badge tone={myReview.moderationStatus === 'published' ? 'success' : myReview.moderationStatus === 'pending' ? 'warning' : 'danger'}>{MODERATION_LABEL[myReview.moderationStatus]}</Badge></div>
            <div className="row">
              <Button size="sm" icon="edit" onClick={() => setEditing(true)}>Sửa</Button>
              <Button size="sm" variant="danger-outline" icon="trash" onClick={() => setDeleting(true)}>Xóa</Button>
            </div>
          </div>
          <Stars value={myReview.rating} />
          {myReview.body && <p style={{ margin: '6px 0 0' }}>{myReview.body}</p>}
          {myReview.moderationStatus === 'pending' && <p className="subtle" style={{ margin: '6px 0 0' }}>Đánh giá sẽ hiển thị công khai và được tính điểm sau khi quản trị viên duyệt.</p>}
          {myReview.moderationStatus === 'hidden' && <p className="subtle text-danger" style={{ margin: '6px 0 0' }}>Đánh giá đã bị ẩn{myReview.moderationReason ? `: ${myReview.moderationReason}` : ''}.</p>}
        </div>
      )}

      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? (
        <EmptyState icon="message" title="Chưa có nhận xét công khai">Hãy là người đầu tiên chia sẻ cảm nhận về món này.</EmptyState>
      ) : (
        <ul className="review-list">
          {list.data!.items.map((r) => (
            <li key={r._id} className="review">
              <div className="row-between">
                <div className="row"><span className="avatar avatar--sm" aria-hidden>{r.authorName[0]}</span><strong>{r.authorName}</strong><span className="subtle">{relativeTime(r.createdAt)}</span></div>
                {user?.role === 'user' && !r.isMine && <Button size="sm" variant="ghost" icon="flag" onClick={() => setReporting(r._id)}>Báo cáo</Button>}
              </div>
              <Stars value={r.rating} />
              {r.body && <p>{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}

      {editing && <ReviewForm dishId={dish._id} existing={myReview} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
      <ConfirmDialog open={deleting} title="Xóa đánh giá?" message="Đánh giá của bạn sẽ bị xóa và điểm trung bình của món được tính lại." confirmLabel="Xóa đánh giá" danger loading={busy} onConfirm={remove} onCancel={() => setDeleting(false)} />
      {reporting && <ReportDialog reviewId={reporting} onClose={() => setReporting(null)} />}
    </section>
  );
}

function ReviewForm({ dishId, existing, onClose, onSaved }: { dishId: string; existing: MyReview | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const fe: Record<string, string> = {};
    if (rating < 1) fe.rating = 'Vui lòng chọn số sao từ 1 đến 5.';
    if (body.length > 1000) fe.body = 'Nhận xét tối đa 1000 ký tự.';
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      if (existing) await reviewService.update(existing._id, rating, body.trim() || undefined);
      else await reviewService.create(dishId, rating, body.trim() || undefined);
      toast.success('Đã gửi đánh giá. Đánh giá sẽ hiển thị sau khi được duyệt.');
      onSaved();
    } catch (e) {
      if (e instanceof ApiRequestError && e.fieldErrors) setErrors(e.fieldErrors);
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={existing ? 'Sửa đánh giá' : 'Viết đánh giá'} closeDisabled={busy} footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" onClick={submit} loading={busy}>Gửi đánh giá</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <RatingInput value={rating} onChange={setRating} error={errors.rating} />
        <Field label="Nhận xét (không bắt buộc)" error={errors.body} hint={`${body.length}/1000 ký tự`}>
          <TextArea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Món ăn thế nào? Công thức có dễ làm không?" />
        </Field>
        {existing && <Alert tone="info">Sau khi sửa, đánh giá sẽ được kiểm duyệt lại trước khi hiển thị công khai.</Alert>}
      </form>
    </Modal>
  );
}

function ReportDialog({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason) return setError('Vui lòng chọn lý do báo cáo.');
    setBusy(true);
    try {
      const r = await reviewService.report(reviewId, detail.trim() ? `${reason}: ${detail.trim()}` : reason);
      toast.success(r.message);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Báo cáo nhận xét" closeDisabled={busy} footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="danger" onClick={submit} loading={busy}>Gửi báo cáo</Button></>}>
      <div className="stack">
        <p className="muted">Báo cáo sẽ được gửi tới quản trị viên. Nhận xét không bị ẩn ngay cho đến khi được kiểm tra.</p>
        <Field label="Lý do" required error={error}>
          <Select value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }}>
            <option value="">– Chọn lý do –</option>
            {REVIEW_REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Mô tả thêm (không bắt buộc)"><TextArea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} /></Field>
      </div>
    </Modal>
  );
}
