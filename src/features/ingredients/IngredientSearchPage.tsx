import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RecommendationResult } from '@/types/api';
import { Alert, Button, CardSkeletonGrid, EmptyState, ErrorState, Icon, PageHeader } from '@/components/ui';
import { IngredientPicker } from '@/components/dish/IngredientPicker';
import { DishCard } from '@/components/dish/DishCard';
import { catalogService, recommendationService, type IngredientOption } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle, usePersistentState } from '@/hooks/misc';

/** UC15–UC17: chọn nguyên liệu đang có → tìm và xếp hạng món theo mức độ khớp. */
export function IngredientSearchPage() {
  useDocumentTitle('Tìm món theo nguyên liệu');
  const { user } = useAuth();
  // Khách: chỉ giữ trong phiên hiện tại (6.4)
  const [guestSelected, setGuestSelected] = usePersistentState<IngredientOption[]>('hnag-guest-ingredients', [], 'session');
  const [selected, setSelected] = useState<IngredientOption[]>(user ? [] : guestSelected);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Người dùng đã đăng nhập: khôi phục danh sách đã lưu
  useEffect(() => {
    if (!user || user.role !== 'user') return;
    let cancelled = false;
    Promise.all([recommendationService.getSelection(), catalogService.ingredients()])
      .then(([sel, all]) => {
        if (cancelled) return;
        const map = new Map(all.items.map((i) => [i._id, i]));
        setSelected(sel.ingredientIds.map((id) => map.get(id)).filter((x): x is IngredientOption => !!x));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user]);

  const update = (next: IngredientOption[]) => {
    setSelected(next);
    if (!user) setGuestSelected(next);
  };

  const search = async () => {
    setTouched(true);
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await recommendationService.get({ mode: 'ingredients', ingredientIds: selected.map((s) => s._id), limit: 24 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page">
      <PageHeader eyebrow="Tận dụng nguyên liệu" title="Tìm món theo nguyên liệu có sẵn" description="Chọn những nguyên liệu bạn đang có. Hệ thống xếp hạng món theo tỷ lệ nguyên liệu bắt buộc đã có và cho biết còn thiếu gì." />
      <div className="ingredient-layout">
        <section className="card card__body stack" aria-labelledby="pick-title">
          <h2 id="pick-title" className="h3">Nguyên liệu bạn đang có</h2>
          <IngredientPicker label="Thêm nguyên liệu" selected={selected} onChange={update} max={20} />
          {touched && selected.length === 0 && <span className="field__error" role="alert"><Icon name="alert" size={14} /> Vui lòng chọn ít nhất một nguyên liệu.</span>}
          <div className="row">
            <Button variant="primary" icon="search" onClick={search} loading={loading} disabled={selected.length === 0}>Tìm món</Button>
            {selected.length > 0 && <Button variant="ghost" onClick={() => { update([]); setResult(null); setTouched(false); }}>Xóa tất cả</Button>}
          </div>
          <p className="subtle">
            {user ? 'Danh sách được lưu vào tài khoản sau mỗi lần tìm.' : 'Danh sách chỉ được giữ trong phiên truy cập này.'}
            {' '}Kết quả so khớp theo <em>danh sách</em> nguyên liệu, chưa xét bạn có đủ định lượng hay không.
          </p>
        </section>

        <section aria-live="polite" aria-busy={loading} aria-label="Kết quả tìm theo nguyên liệu">
          {loading && !result ? <CardSkeletonGrid count={4} /> : error ? <ErrorState message={error} onRetry={search} /> : !result ? (
            <EmptyState icon="carrot" title="Chọn nguyên liệu để bắt đầu">Ví dụ: trứng gà, cà chua, hành lá – rồi bấm “Tìm món”.</EmptyState>
          ) : result.items.length === 0 ? (
            <EmptyState icon="utensils" title="Chưa có món phù hợp">{result.emptyReason} Hãy thêm hoặc đổi nguyên liệu.</EmptyState>
          ) : (
            <div className="stack">
              {result.appliedProfile && <Alert tone="info">Đã loại các món chứa nguyên liệu cần tránh trong <Link to="/tai-khoan/ho-so">hồ sơ của bạn</Link>.</Alert>}
              <p className="muted">Tìm thấy {result.items.length} món, sắp xếp theo mức độ khớp nguyên liệu bắt buộc.</p>
              <div className="grid-cards">
                {result.items.map((item) => {
                  const m = item.match!;
                  const pct = m.ratio === null ? null : Math.round(m.ratio * 100);
                  return (
                    <DishCard
                      key={item.dish._id}
                      dish={item.dish}
                      recId={result.eventId}
                      extra={
                        <div className="match">
                          {pct === null ? (
                            <span className="badge badge--warning">Cần xác minh công thức</span>
                          ) : (
                            <>
                              <div className="row-between small">
                                <strong>Khớp danh sách {m.requiredHave}/{m.requiredTotal} nguyên liệu bắt buộc</strong>
                                <span className="match__pct">{pct}%</span>
                              </div>
                              <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Mức độ khớp nguyên liệu">
                                <div className="meter__bar" style={{ width: `${pct}%` }} />
                              </div>
                            </>
                          )}
                          <details className="match__details" open={m.missing.length > 0 && m.missing.length <= 2}>
                            <summary>Xem nguyên liệu đã có và còn thiếu</summary>
                            <dl className="match__dl">
                              <dt><Icon name="check" size={14} /> Đã có</dt>
                              <dd>{m.have.length ? m.have.map((x) => x.name).join(', ') : '—'}</dd>
                              <dt><Icon name="alert" size={14} /> Còn thiếu ({m.missing.length})</dt>
                              <dd className={m.missing.length ? 'text-danger' : ''}>{m.missing.length ? m.missing.map((x) => x.name).join(', ') : 'Không thiếu nguyên liệu bắt buộc nào'}</dd>
                              {m.optional.length > 0 && (
                                <>
                                  <dt>Tùy chọn</dt>
                                  <dd>{m.optional.map((x) => `${x.name}${x.have ? ' ✓' : ''}`).join(', ')}</dd>
                                </>
                              )}
                            </dl>
                          </details>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
