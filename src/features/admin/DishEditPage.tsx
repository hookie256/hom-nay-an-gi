import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DishInput, ValidationResult } from '@/types/api';
import type { Difficulty, Dish, DishIngredient, DishStep } from '@/types/models';
import { Alert, Badge, Button, Checkbox, Chip, ErrorState, Field, Icon, Input, Loading, PageHeader, Select, TextArea } from '@/components/ui';
import { adminService } from '@/services';
import { ApiRequestError } from '@/services/apiClient';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { DIETS, DIFFICULTY_LABEL, INGREDIENT_GROUPS, TASTES } from '@/domain/constants';
import { slugify } from '@/domain/text';
import { DISH_STATUS } from './DishesPage';

type IngRow = DishIngredient & { key: string };
type StepRow = DishStep & { key: string };
interface FormState extends Omit<DishInput, 'ingredients' | 'steps' | 'images'> {
  images: string;
  ingredients: IngRow[];
  steps: StepRow[];
  dietDeclared: boolean;
}

let keySeq = 0;
const k = () => `k${++keySeq}`;

function toForm(d?: Dish): FormState {
  return {
    name: d?.name ?? '', slug: d?.slug ?? '', description: d?.description ?? '', images: (d?.images ?? []).join('\n'),
    mealSlotIds: d?.mealSlotIds ?? [], categoryIds: d?.categoryIds ?? [], cuisineIds: d?.cuisineIds ?? [], tasteTags: d?.tasteTags ?? [],
    dietCodes: d?.dietCodes ?? [], dietDeclared: !!d?.dietCodes,
    baseServings: d?.baseServings ?? 2, prepMinutes: d?.prepMinutes ?? 10, cookMinutes: d?.cookMinutes ?? 15, difficulty: d?.difficulty ?? 'easy',
    ingredients: (d?.ingredients ?? []).map((i) => ({ ...i, key: k() })),
    steps: (d?.steps ?? []).map((s) => ({ ...s, key: k() })),
    nutrition: d?.nutrition, source: d?.source ?? '',
  };
}

function toInput(f: FormState): Partial<DishInput> {
  return {
    name: f.name, slug: f.slug, description: f.description, images: f.images.split('\n').map((x) => x.trim()).filter(Boolean),
    mealSlotIds: f.mealSlotIds, categoryIds: f.categoryIds, cuisineIds: f.cuisineIds, tasteTags: f.tasteTags,
    dietCodes: f.dietDeclared ? f.dietCodes : undefined,
    baseServings: Number(f.baseServings), prepMinutes: Number(f.prepMinutes), cookMinutes: Number(f.cookMinutes), difficulty: f.difficulty,
    ingredients: f.ingredients.map(({ key: _k, ...i }) => ({ ...i, quantity: Number(i.quantity) })),
    steps: f.steps.map(({ key: _k, ...s }, idx) => ({ ...s, stepNo: idx + 1, durationMinutes: s.durationMinutes === undefined || (s.durationMinutes as unknown) === '' ? undefined : Number(s.durationMinutes) })),
    nutrition: f.nutrition, source: f.source,
  };
}

/** UC53–UC55, UC61–UC63: tạo/sửa món, nguyên liệu, các bước; kiểm tra và xuất bản. */
export function DishEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'moi';
  const navigate = useNavigate();
  const toast = useToast();
  const refs = useQuery(async () => {
    const [cats, ings, units] = await Promise.all([adminService.categories(), adminService.ingredients({ pageSize: 500 }), adminService.units()]);
    return { cats: cats.items, ings: ings.items, units: units.items };
  }, []);
  const dishQ = useQuery(() => adminService.dish(id!), [id], { enabled: !isNew });
  const dish = dishQ.data?.dish;
  useDocumentTitle(isNew ? 'Thêm món' : dish ? `Sửa: ${dish.name}` : 'Sửa món');

  const [form, setForm] = useState<FormState>(() => toForm());
  const [version, setVersion] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [check, setCheck] = useState<ValidationResult | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (dish) {
      setForm(toForm(dish));
      setVersion(dish.version);
      setDirty(false);
    }
  }, [dish]);

  // Cảnh báo khi rời trang lúc còn thay đổi chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const toggleIn = (key: 'mealSlotIds' | 'categoryIds' | 'cuisineIds' | 'tasteTags' | 'dietCodes', v: string) => {
    const arr = (form[key] ?? []) as string[];
    update({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } as Partial<FormState>);
  };
  const setIng = (idx: number, patch: Partial<IngRow>) => update({ ingredients: form.ingredients.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  const setStep = (idx: number, patch: Partial<StepRow>) => update({ steps: form.steps.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...form.steps];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    update({ steps: next });
  };

  const groupedIngs = useMemo(() => INGREDIENT_GROUPS.map((g) => ({ g, items: (refs.data?.ings ?? []).filter((i) => i.groupId === g.code) })), [refs.data]);

  if (refs.loading || (!isNew && dishQ.loading && !dish)) return <Loading />;
  if (refs.error || dishQ.error) return <ErrorState message={(refs.error ?? dishQ.error)!.message} onRetry={() => { refs.reload(); dishQ.reload(); }} />;
  const { cats, ings, units } = refs.data!;
  const byType = (t: string) => cats.filter((c) => c.type === t && (c.status === 'active' || form.mealSlotIds.includes(c._id) || form.categoryIds.includes(c._id) || form.cuisineIds.includes(c._id)));
  const err = (key: string) => errors[key];

  const save = async () => {
    setBusy('save');
    setErrors({});
    setConflict(false);
    try {
      if (isNew) {
        const r = await adminService.createDish(toInput(form));
        toast.success('Đã lưu món ở trạng thái nháp.');
        setDirty(false);
        navigate(`/admin/mon-an/${r.dish._id}`, { replace: true });
      } else {
        const r = await adminService.updateDish(id!, { ...toInput(form), version });
        setVersion(r.dish.version);
        setDirty(false);
        dishQ.setData({ dish: r.dish });
        toast.success('Đã lưu thay đổi.');
        if (r.revertedToDraft) toast.show('Công thức chưa đủ điều kiện nên món đã chuyển về nháp và tạm ẩn khỏi trang công khai.');
      }
      setCheck(null);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.code === 'VERSION_CONFLICT') setConflict(true);
        if (e.fieldErrors) setErrors(e.fieldErrors);
        toast.error(e.message);
      } else toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const validate = async () => {
    if (dirty) return toast.show('Hãy lưu thay đổi trước khi kiểm tra công thức.');
    setBusy('check');
    try {
      const r = await adminService.validateDish(id!);
      setCheck(r);
      setErrors(Object.fromEntries(r.issues.map((i) => [i.field, i.message])));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (dirty) return toast.show('Hãy lưu thay đổi trước khi xuất bản.');
    setBusy('publish');
    try {
      const r = await adminService.publishDish(id!);
      dishQ.setData({ dish: r.dish });
      setCheck({ ok: true, issues: [] });
      toast.success('Đã xuất bản món. Món sẽ xuất hiện trong tìm kiếm và gợi ý.');
    } catch (e) {
      if (e instanceof ApiRequestError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setCheck({ ok: false, issues: Object.entries(e.fieldErrors).map(([field, message]) => ({ field, message })) });
      }
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack dish-editor">
      <Link to="/admin/mon-an" className="small"><Icon name="chevronLeft" size={14} /> Danh sách món</Link>
      <PageHeader
        title={isNew ? 'Thêm món mới' : dish?.name}
        description={isNew ? 'Món mới được lưu ở trạng thái nháp và chưa hiển thị công khai.' : undefined}
        actions={!isNew && dish && <Badge tone={DISH_STATUS[dish.status].tone}>{DISH_STATUS[dish.status].label}</Badge>}
      />
      {conflict && (
        <Alert tone="danger" title="Món đã được người khác cập nhật" action={<Button size="sm" onClick={() => { setConflict(false); dishQ.reload(); }}>Tải bản mới (bỏ thay đổi của tôi)</Button>}>
          Để tránh ghi đè, hãy tải bản mới nhất rồi nhập lại thay đổi.
        </Alert>
      )}
      {check && (
        check.ok ? <Alert tone="success">Công thức đủ điều kiện xuất bản.</Alert> : (
          <Alert tone="warning" title="Chưa đủ điều kiện xuất bản">
            <ul className="issue-list">{check.issues.map((i) => <li key={i.field + i.message}>{i.message}</li>)}</ul>
          </Alert>
        )
      )}

      <section className="fieldset stack">
        <h2 className="h3">Thông tin cơ bản</h2>
        <div className="form-grid form-grid--2">
          <Field label="Tên món" required error={err('name')}><Input value={form.name} onChange={(e) => update({ name: e.target.value })} maxLength={120} /></Field>
          <Field label="Đường dẫn (slug)" error={err('slug')} hint={`Để trống sẽ tạo từ tên: /mon/${slugify(form.slug || form.name) || '…'}`}><Input value={form.slug} onChange={(e) => update({ slug: e.target.value })} /></Field>
        </div>
        <Field label="Mô tả ngắn"><TextArea value={form.description} onChange={(e) => update({ description: e.target.value })} maxLength={500} /></Field>
        <div className="form-grid form-grid--2">
          <Field label="Ảnh món (mỗi dòng một đường dẫn)" hint="Ảnh được lưu ở kho tệp; tại đây chỉ nhập đường dẫn. Để trống sẽ dùng hình minh họa." error={Object.keys(errors).find((x) => x.startsWith('images.')) && 'Có đường dẫn ảnh không hợp lệ.'}>
            <TextArea value={form.images} onChange={(e) => update({ images: e.target.value })} placeholder="https://…/pho-bo.jpg" />
          </Field>
          <Field label="Nguồn công thức/hình ảnh" hint="Phục vụ rà soát nội dung."><TextArea value={form.source} onChange={(e) => update({ source: e.target.value })} /></Field>
        </div>
      </section>

      <section className="fieldset stack">
        <h2 className="h3">Phân loại</h2>
        <fieldset className="filter-group" aria-invalid={!!err('mealSlotIds')}>
          <legend>Buổi ăn <span className="req">*</span></legend>
          <div className="row">{byType('mealSlot').map((c) => <Checkbox key={c._id} label={`${c.name}${c.status !== 'active' ? ' (đã ẩn)' : ''}`} checked={form.mealSlotIds.includes(c._id)} onChange={() => toggleIn('mealSlotIds', c._id)} />)}</div>
          {err('mealSlotIds') && <span className="field__error">{err('mealSlotIds')}</span>}
        </fieldset>
        <fieldset className="filter-group"><legend>Loại món & thẻ</legend>
          <div className="row">{[...byType('dishType'), ...byType('tag')].map((c) => <Checkbox key={c._id} label={`${c.name}${c.status !== 'active' ? ' (đã ẩn)' : ''}`} checked={form.categoryIds.includes(c._id)} onChange={() => toggleIn('categoryIds', c._id)} />)}</div>
          {err('categoryIds') && <span className="field__error">{err('categoryIds')}</span>}
        </fieldset>
        <fieldset className="filter-group"><legend>Loại ẩm thực</legend>
          <div className="row">{byType('cuisine').map((c) => <Checkbox key={c._id} label={c.name} checked={form.cuisineIds.includes(c._id)} onChange={() => toggleIn('cuisineIds', c._id)} />)}</div>
        </fieldset>
        <fieldset className="filter-group"><legend>Khẩu vị</legend>
          <div className="row">{TASTES.map((t) => <Chip key={t.code} active={form.tasteTags.includes(t.code)} onClick={() => toggleIn('tasteTags', t.code)}>{t.label}</Chip>)}</div>
        </fieldset>
        <fieldset className="filter-group"><legend>Chế độ ăn</legend>
          <Checkbox label="Đã rà soát và khai báo chế độ ăn cho món" checked={form.dietDeclared} onChange={(e) => update({ dietDeclared: e.target.checked })} />
          {form.dietDeclared ? <div className="row">{DIETS.map((d) => <Checkbox key={d.code} label={d.label} checked={(form.dietCodes ?? []).includes(d.code)} onChange={() => toggleIn('dietCodes', d.code)} />)}</div>
            : <span className="field__hint">Chưa khai báo: món sẽ không xuất hiện khi người dùng lọc theo chế độ ăn.</span>}
        </fieldset>
      </section>

      <section className="fieldset stack">
        <h2 className="h3">Khẩu phần & thời gian</h2>
        <div className="form-grid form-grid--2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="Khẩu phần gốc" required error={err('baseServings')}><Input type="number" min={1} value={form.baseServings} onChange={(e) => update({ baseServings: e.target.value as unknown as number })} /></Field>
          <Field label="Sơ chế (phút)" required error={err('prepMinutes')}><Input type="number" min={0} value={form.prepMinutes} onChange={(e) => update({ prepMinutes: e.target.value as unknown as number })} /></Field>
          <Field label="Nấu (phút)" required error={err('cookMinutes')}><Input type="number" min={0} value={form.cookMinutes} onChange={(e) => update({ cookMinutes: e.target.value as unknown as number })} /></Field>
          <Field label="Độ khó" required error={err('difficulty')}><Select value={form.difficulty} onChange={(e) => update({ difficulty: e.target.value as Difficulty })}>{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</Select></Field>
        </div>
      </section>

      <section className="fieldset stack" aria-labelledby="ing-ed">
        <div className="row-between"><h2 id="ing-ed" className="h3" style={{ margin: 0 }}>Nguyên liệu ({form.ingredients.length})</h2><Link to="/admin/nguyen-lieu" className="small" target="_blank">Quản lý danh mục nguyên liệu</Link></div>
        <p className="subtle" style={{ margin: 0 }}>Định lượng tính theo khẩu phần gốc. Đánh dấu “Bắt buộc” để dùng khi tính mức độ khớp nguyên liệu.</p>
        {err('ingredients') && <span className="field__error">{err('ingredients')}</span>}
        <div className="ing-editor">
          {form.ingredients.map((r, idx) => {
            const cur = dish?.ingredients.some((x) => x.ingredientId === r.ingredientId);
            return (
              <div key={r.key} className="ing-editor__row">
                <Field label={`Nguyên liệu ${idx + 1}`} error={err(`ingredients.${idx}.ingredientId`)}>
                  <Select value={r.ingredientId} onChange={(e) => setIng(idx, { ingredientId: e.target.value })}>
                    <option value="">– Chọn –</option>
                    {groupedIngs.map(({ g, items }) => items.length > 0 && (
                      <optgroup key={g.code} label={g.label}>
                        {items.map((i) => <option key={i._id} value={i._id} disabled={i.status === 'inactive' && !(cur && i._id === r.ingredientId)}>{i.canonicalName}{i.status === 'inactive' ? ' (ngừng dùng)' : ''}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Định lượng" error={err(`ingredients.${idx}.quantity`)}><Input type="number" min={0} step="any" value={r.quantity} onChange={(e) => setIng(idx, { quantity: e.target.value as unknown as number })} /></Field>
                <Field label="Đơn vị" error={err(`ingredients.${idx}.unitId`)}>
                  <Select value={r.unitId} onChange={(e) => setIng(idx, { unitId: e.target.value })}>
                    <option value="">–</option>
                    {units.map((u) => <option key={u._id} value={u._id} disabled={u.status === 'inactive' && u._id !== r.unitId}>{u.symbol}{u.status === 'inactive' ? ' (ngừng dùng)' : ''}</option>)}
                  </Select>
                </Field>
                <Field label="Ghi chú sơ chế"><Input value={r.preparationNote ?? ''} onChange={(e) => setIng(idx, { preparationNote: e.target.value })} placeholder="thái nhỏ…" /></Field>
                <div className="ing-editor__end">
                  <Checkbox label="Bắt buộc" checked={r.required} onChange={(e) => setIng(idx, { required: e.target.checked })} />
                  <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Xóa nguyên liệu ${idx + 1}`} onClick={() => update({ ingredients: form.ingredients.filter((_, i) => i !== idx) })} />
                </div>
              </div>
            );
          })}
        </div>
        <div><Button icon="plus" onClick={() => update({ ingredients: [...form.ingredients, { key: k(), ingredientId: '', quantity: 1, unitId: units.find((u) => u.symbol === 'g')?._id ?? '', required: true }] })}>Thêm nguyên liệu</Button></div>
        {ings.length === 0 && <Alert tone="warning">Chưa có nguyên liệu trong danh mục.</Alert>}
      </section>

      <section className="fieldset stack" aria-labelledby="step-ed">
        <h2 id="step-ed" className="h3" style={{ margin: 0 }}>Các bước chế biến ({form.steps.length})</h2>
        {err('steps') && <span className="field__error">{err('steps')}</span>}
        <ol className="step-editor">
          {form.steps.map((s, idx) => (
            <li key={s.key} className="step-editor__item">
              <div className="row-between">
                <strong>Bước {idx + 1}</strong>
                <div className="row">
                  <Button size="sm" variant="ghost" iconOnly icon="arrowUp" aria-label={`Đưa bước ${idx + 1} lên`} disabled={idx === 0} onClick={() => moveStep(idx, -1)} />
                  <Button size="sm" variant="ghost" iconOnly icon="arrowDown" aria-label={`Đưa bước ${idx + 1} xuống`} disabled={idx === form.steps.length - 1} onClick={() => moveStep(idx, 1)} />
                  <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Xóa bước ${idx + 1}`} onClick={() => update({ steps: form.steps.filter((_, i) => i !== idx) })} />
                </div>
              </div>
              <div className="form-grid form-grid--2">
                <Field label="Tiêu đề" required error={err(`steps.${idx}.title`)}><Input value={s.title} onChange={(e) => setStep(idx, { title: e.target.value })} /></Field>
                <Field label="Thời gian (phút)" error={err(`steps.${idx}.durationMinutes`)}><Input type="number" min={0} value={s.durationMinutes ?? ''} onChange={(e) => setStep(idx, { durationMinutes: e.target.value === '' ? undefined : (e.target.value as unknown as number) })} /></Field>
              </div>
              <Field label="Hướng dẫn" required error={err(`steps.${idx}.instruction`)}><TextArea value={s.instruction} onChange={(e) => setStep(idx, { instruction: e.target.value })} /></Field>
              <div className="form-grid form-grid--2">
                <Field label="Lưu ý"><Input value={s.note ?? ''} onChange={(e) => setStep(idx, { note: e.target.value })} /></Field>
                <Field label="Ảnh minh họa (đường dẫn)"><Input value={s.imageUrl ?? ''} onChange={(e) => setStep(idx, { imageUrl: e.target.value })} /></Field>
              </div>
            </li>
          ))}
        </ol>
        <div><Button icon="plus" onClick={() => update({ steps: [...form.steps, { key: k(), stepNo: form.steps.length + 1, title: '', instruction: '' }] })}>Thêm bước</Button></div>
      </section>

      <div className="sticky-actions">
        <span className="subtle">{dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</span>
        <div className="row">
          <Button variant="primary" icon="check" onClick={save} loading={busy === 'save'} disabled={!!busy && busy !== 'save'}>{isNew ? 'Lưu nháp' : 'Lưu thay đổi'}</Button>
          {!isNew && <Button onClick={validate} loading={busy === 'check'} disabled={!!busy && busy !== 'check'}>Kiểm tra công thức</Button>}
          {!isNew && dish?.status !== 'published' && <Button variant="accent" onClick={publish} loading={busy === 'publish'} disabled={!!busy && busy !== 'publish'}>Xuất bản</Button>}
        </div>
      </div>
    </div>
  );
}
