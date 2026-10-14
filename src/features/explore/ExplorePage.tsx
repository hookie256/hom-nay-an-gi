import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DishCard as DishCardData, DishListQuery } from '@/types/api';
import { Alert, Button, CardSkeletonGrid, Checkbox, Chip, EmptyState, ErrorState, Field, Icon, Modal, PageHeader, SearchInput, Segmented, Select } from '@/components/ui';
import { DishCard } from '@/components/dish/DishCard';
import { IngredientPicker } from '@/components/dish/IngredientPicker';
import { catalogService, profileService, type IngredientOption } from '@/services';
import { useCatalog } from '@/contexts/CatalogContext';
import { useAuth } from '@/contexts/AuthContext';
import { DIETS, DIFFICULTY_LABEL, PAGE_SIZE, TASTES } from '@/domain/constants';
import { useDebounce, useDocumentTitle } from '@/hooks/misc';
import { useQuery } from '@/hooks/useQuery';
import type { Difficulty } from '@/types/models';

const MULTI_KEYS = ['mealSlot', 'dishType', 'cuisine', 'tag', 'difficulty', 'taste', 'diet', 'exclude', 'ingredient'] as const;
type MultiKey = (typeof MULTI_KEYS)[number];
const SORTS = [
  { value: 'relevance', label: 'Phù hợp nhất' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'time', label: 'Nấu nhanh nhất' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến' },
] as const;
const TIME_LIMITS = [15, 30, 45, 60, 90];

/** UC18–UC25: danh sách, tìm theo tên/nguyên liệu, lọc kết hợp, loại trừ, sắp xếp, tải thêm. */
export function ExplorePage() {
  useDocumentTitle('Khám phá món ăn');
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const catalog = useCatalog();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<'name' | 'ingredient'>(params.getAll('ingredient').length ? 'ingredient' : 'name');
  const [keyword, setKeyword] = useState(params.get('q') ?? '');
  const debouncedKeyword = useDebounce(keyword, 350);
  const allIngredients = useQuery(() => catalogService.ingredients(), []);
  const ingById = useMemo(() => new Map((allIngredients.data?.items ?? []).map((i) => [i._id, i])), [allIngredients.data]);

  const get = (k: MultiKey) => params.getAll(k);
  const sort = (params.get('sort') ?? 'relevance') as NonNullable<DishListQuery['sort']>;
  const maxMinutes = params.get('maxMinutes') ? Number(params.get('maxMinutes')) : undefined;

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  };
  const toggle = (k: MultiKey, v: string) => update((p) => {
    const cur = p.getAll(k);
    p.delete(k);
    (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).forEach((x) => p.append(k, x));
  });
  const setMulti = (k: MultiKey, values: string[]) => update((p) => { p.delete(k); values.forEach((v) => p.append(k, v)); });

  // Đồng bộ ô tìm kiếm theo tên lên URL
  useEffect(() => {
    if ((params.get('q') ?? '') === debouncedKeyword.trim()) return;
    update((p) => (debouncedKeyword.trim() ? p.set('q', debouncedKeyword.trim()) : p.delete('q')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword]);

  // 6.6: nguyên liệu cần tránh trong hồ sơ được đưa vào điều kiện lọc ban đầu, người dùng vẫn bỏ được
  const appliedProfile = useRef(false);
  useEffect(() => {
    if (!user || user.role !== 'user' || appliedProfile.current || params.has('exclude') || params.has('np')) return;
    appliedProfile.current = true;
    profileService.get().then((r) => {
      if (r.profile.avoidedIngredientIds.length) setMulti('exclude', r.profile.avoidedIngredientIds);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---- tải dữ liệu, “Xem thêm” cộng dồn trang ----
  const queryKey = useMemo(() => {
    const p = new URLSearchParams(params);
    p.delete('np');
    return p.toString();
  }, [params]);
  // Trang hiện tại gắn với bộ điều kiện; đổi điều kiện thì tự về trang 1
  const [pageState, setPageState] = useState({ key: queryKey, page: 1 });
  const page = pageState.key === queryKey ? pageState.page : 1;
  const setPage = (fn: (p: number) => number) => setPageState({ key: queryKey, page: fn(page) });
  const [items, setItems] = useState<DishCardData[]>([]);
  const q = useQuery(
    () => catalogService.dishes({
      q: params.get('q') ?? undefined,
      ingredient: get('ingredient'), mealSlot: get('mealSlot'), dishType: get('dishType'), cuisine: get('cuisine'), tag: get('tag'),
      difficulty: get('difficulty') as Difficulty[], taste: get('taste'), diet: get('diet'), exclude: get('exclude'),
      maxMinutes, sort, page, pageSize: PAGE_SIZE,
    }),
    [queryKey, page],
  );
  useEffect(() => {
    if (!q.data) return;
    setItems((prev) => (q.data!.page === 1 ? q.data!.items : [...prev, ...q.data!.items.filter((d) => !prev.some((x) => x._id === d._id))]));
  }, [q.data]);

  // ---- nhãn bộ lọc đang áp dụng ----
  const catName = (slug: string) => catalog.categories.find((c) => c.slug === slug)?.name ?? slug;
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (params.get('q')) chips.push({ key: 'q', label: `Tên: “${params.get('q')}”`, remove: () => { setKeyword(''); update((p) => p.delete('q')); } });
  get('ingredient').forEach((id) => chips.push({ key: `i-${id}`, label: `Có: ${ingById.get(id)?.canonicalName ?? '…'}`, remove: () => toggle('ingredient', id) }));
  (['mealSlot', 'dishType', 'cuisine', 'tag'] as const).forEach((k) => get(k).forEach((s) => chips.push({ key: `${k}-${s}`, label: catName(s), remove: () => toggle(k, s) })));
  get('difficulty').forEach((d) => chips.push({ key: `d-${d}`, label: `Độ khó: ${DIFFICULTY_LABEL[d as Difficulty]}`, remove: () => toggle('difficulty', d) }));
  get('taste').forEach((t) => chips.push({ key: `t-${t}`, label: `Vị ${TASTES.find((x) => x.code === t)?.label.toLowerCase()}`, remove: () => toggle('taste', t) }));
  get('diet').forEach((t) => chips.push({ key: `di-${t}`, label: DIETS.find((x) => x.code === t)?.label ?? t, remove: () => toggle('diet', t) }));
  if (maxMinutes) chips.push({ key: 'mm', label: `≤ ${maxMinutes} phút`, remove: () => update((p) => p.delete('maxMinutes')) });
  get('exclude').forEach((id) => chips.push({ key: `x-${id}`, label: `Không có: ${ingById.get(id)?.canonicalName ?? '…'}`, remove: () => update((p) => { const cur = p.getAll('exclude').filter((x) => x !== id); p.delete('exclude'); cur.forEach((x) => p.append('exclude', x)); p.set('np', '1'); }) }));

  const clearAll = () => {
    setKeyword('');
    setParams(new URLSearchParams(sort !== 'relevance' ? { sort, np: '1' } : { np: '1' }), { replace: true });
  };

  const filterPanel = (
    <div className="filter-panel stack">
      <p className="subtle">Chọn nhiều giá trị trong cùng một nhóm: món chỉ cần thỏa <strong>ít nhất một</strong>. Các nhóm khác nhau được áp dụng đồng thời.</p>
      {([['mealSlot', 'Buổi ăn'], ['dishType', 'Loại món'], ['cuisine', 'Loại ẩm thực'], ['tag', 'Thẻ']] as const).map(([k, label]) => {
        const type = k === 'mealSlot' ? 'mealSlot' : k === 'dishType' ? 'dishType' : k === 'cuisine' ? 'cuisine' : 'tag';
        return (
          <fieldset key={k} className="filter-group">
            <legend>{label}</legend>
            {catalog.byType(type).map((c) => <Checkbox key={c._id} label={c.name} checked={get(k).includes(c.slug)} onChange={() => toggle(k, c.slug)} />)}
          </fieldset>
        );
      })}
      <fieldset className="filter-group">
        <legend>Thời gian chế biến</legend>
        <Select value={maxMinutes ?? ''} onChange={(e) => update((p) => (e.target.value ? p.set('maxMinutes', e.target.value) : p.delete('maxMinutes')))} aria-label="Thời gian tối đa">
          <option value="">Không giới hạn</option>
          {TIME_LIMITS.map((m) => <option key={m} value={m}>Tối đa {m} phút</option>)}
        </Select>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Độ khó</legend>
        {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <Checkbox key={d} label={DIFFICULTY_LABEL[d]} checked={get('difficulty').includes(d)} onChange={() => toggle('difficulty', d)} />)}
      </fieldset>
      <fieldset className="filter-group">
        <legend>Khẩu vị</legend>
        {TASTES.map((t) => <Checkbox key={t.code} label={t.label} checked={get('taste').includes(t.code)} onChange={() => toggle('taste', t.code)} />)}
      </fieldset>
      <fieldset className="filter-group">
        <legend>Chế độ ăn</legend>
        {DIETS.map((t) => <Checkbox key={t.code} label={t.label} checked={get('diet').includes(t.code)} onChange={() => toggle('diet', t.code)} />)}
        <span className="field__hint">Món chưa khai báo chế độ ăn không được xem là phù hợp.</span>
      </fieldset>
      <div className="filter-group">
        <IngredientPicker
          label="Loại trừ nguyên liệu"
          placeholder="Ví dụ: tôm, lạc…"
          selected={get('exclude').map((id) => ingById.get(id)).filter((x): x is IngredientOption => !!x)}
          onChange={(next) => update((p) => { p.delete('exclude'); next.forEach((n) => p.append('exclude', n._id)); p.set('np', '1'); })}
        />
      </div>
    </div>
  );

  const total = q.data?.total ?? 0;
  return (
    <div className="container page">
      <PageHeader eyebrow="Khám phá" title="Tất cả món ăn" description="Tìm theo tên hoặc nguyên liệu, kết hợp bộ lọc và sắp xếp theo ý bạn." />
      <div className="explore-search card card__body">
        <Segmented label="Tìm theo" value={mode} onChange={(m) => { setMode(m); if (m === 'name') setMulti('ingredient', []); else { setKeyword(''); update((p) => p.delete('q')); } }}
          options={[{ value: 'name', label: 'Tên món', icon: 'utensils' }, { value: 'ingredient', label: 'Nguyên liệu', icon: 'carrot' }]} />
        {mode === 'name' ? (
          <Field label="Tìm theo tên món" labelHidden>
            <SearchInput placeholder="Nhập tên món, ví dụ: phở, canh chua…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </Field>
        ) : (
          <IngredientPicker label="Món có dùng các nguyên liệu" selected={get('ingredient').map((id) => ingById.get(id)).filter((x): x is IngredientOption => !!x)} onChange={(n) => setMulti('ingredient', n.map((x) => x._id))} />
        )}
      </div>

      <div className="explore-layout">
        <aside className="explore-sidebar card card__body" aria-label="Bộ lọc">
          <h2 className="h3">Bộ lọc</h2>
          {filterPanel}
        </aside>
        <section aria-label="Kết quả" className="stack">
          <div className="row-between">
            <div className="row">
              <Button className="filters-toggle" icon="filter" onClick={() => setFiltersOpen(true)}>Bộ lọc{chips.length ? ` (${chips.length})` : ''}</Button>
              <span className="muted small" aria-live="polite">{q.loading && page === 1 ? 'Đang tải…' : `${total} món`}</span>
            </div>
            <label className="row small">
              <span className="muted">Sắp xếp</span>
              <Select value={sort} onChange={(e) => update((p) => p.set('sort', e.target.value))} style={{ width: 'auto' }} aria-label="Sắp xếp">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="row" aria-label="Bộ lọc đang áp dụng">
              {chips.map((c) => <Chip key={c.key} onRemove={c.remove} removeLabel={`Bỏ điều kiện ${c.label}`}>{c.label}</Chip>)}
              <Button size="sm" variant="ghost" onClick={clearAll}>Xóa tất cả</Button>
            </div>
          )}
          {q.data && q.data.needsVerification > 0 && (
            <p className="subtle"><Icon name="info" size={14} /> {q.data.needsVerification} món bị loại vì thiếu dữ liệu thành phần, cần quản trị viên xác minh.</p>
          )}
          {q.error && items.length > 0 && <Alert tone="danger" title="Không tải được kết quả mới">{q.error.message} Danh sách bên dưới là kết quả trước đó. <Button size="sm" variant="ghost" onClick={q.reload}>Thử lại</Button></Alert>}
          <div aria-live="polite" aria-busy={q.loading}>
            {q.loading && items.length === 0 ? <CardSkeletonGrid count={6} /> : q.error && items.length === 0 ? <ErrorState message={q.error.message} onRetry={q.reload} /> :
              q.data?.popularityUnavailable ? (
                <EmptyState icon="chart" title="Chưa có dữ liệu phổ biến">Chỉ số phổ biến chưa có trong 30 ngày gần nhất. Hãy chọn cách sắp xếp khác.</EmptyState>
              ) : items.length === 0 && !q.loading ? (
                <EmptyState icon="search" title="Không tìm thấy món phù hợp" action={chips.length ? <Button onClick={clearAll}>Xóa tất cả bộ lọc</Button> : undefined}>
                  Các điều kiện bạn chọn vẫn được giữ nguyên. Hãy bỏ bớt từng điều kiện ở trên{params.get('q') ? ' hoặc sửa từ khóa' : ''}.
                </EmptyState>
              ) : (
                <div className={['grid-cards', q.loading && page === 1 && 'is-refreshing'].filter(Boolean).join(' ')}>{items.map((d) => <DishCard key={d._id} dish={d} />)}</div>
              )}
          </div>
          {q.data?.hasMore && (
            <div style={{ textAlign: 'center' }}>
              <Button onClick={() => setPage((p) => p + 1)} loading={q.loading && page > 1}>Xem thêm món</Button>
            </div>
          )}
        </section>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Bộ lọc" footer={<><Button variant="ghost" onClick={clearAll}>Xóa tất cả</Button><Button variant="primary" onClick={() => setFiltersOpen(false)}>Xem {total} món</Button></>}>
        {filterPanel}
      </Modal>
    </div>
  );
}
