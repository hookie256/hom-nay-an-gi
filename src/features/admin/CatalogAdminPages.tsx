import { useState } from 'react';
import type { CategoryRow, IngredientRow, UnitRow } from '@/types/api';
import type { CategoryType } from '@/types/models';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, Tabs } from '@/components/ui';
import { adminService } from '@/services';
import { ApiRequestError } from '@/services/apiClient';
import { useToast } from '@/contexts/ToastContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce, useDocumentTitle } from '@/hooks/misc';
import { INGREDIENT_GROUPS } from '@/domain/constants';

function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(key: string, fn: () => Promise<T>, ok?: string, onFieldErrors?: (fe: Record<string, string>) => void): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      if (e instanceof ApiRequestError && e.fieldErrors && onFieldErrors) onFieldErrors(e.fieldErrors);
      toast.error((e as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

// ======================= Nguyên liệu (UC57, UC59, UC60) =======================
export function IngredientsAdminPage() {
  useDocumentTitle('Quản lý nguyên liệu');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery(() => adminService.ingredients({ q: q || undefined, group: group || undefined, status: status || undefined, page }), [q, group, status, page]);
  const all = useQuery(() => adminService.ingredients({ pageSize: 500 }), []);
  const [editing, setEditing] = useState<IngredientRow | 'new' | null>(null);
  const [subFor, setSubFor] = useState<IngredientRow | null>(null);
  const [del, setDel] = useState<IngredientRow | null>(null);
  const { busy, run } = useAction();
  const groupLabel = (c?: string) => INGREDIENT_GROUPS.find((g) => g.code === c)?.label ?? '—';
  const nameOf = (id: string) => all.data?.items.find((i) => i._id === id)?.canonicalName ?? id;
  const reload = () => { list.reload(); all.reload(); };

  return (
    <div className="stack">
      <PageHeader title="Nguyên liệu" description="Tên chuẩn dùng thống nhất trong công thức, tìm kiếm và gợi ý. Tên gọi khác giúp người dùng tìm được nguyên liệu." actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Thêm nguyên liệu</Button>} />
      <div className="form-grid form-grid--3 card card__body">
        <Field label="Tìm kiếm"><SearchInput placeholder="Tên chuẩn hoặc tên gọi khác…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Field>
        <Field label="Nhóm"><Select value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }}><option value="">Tất cả</option>{INGREDIENT_GROUPS.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}</Select></Field>
        <Field label="Trạng thái"><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="active">Đang dùng</option><option value="inactive">Ngừng dùng</option></Select></Field>
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState title="Không có nguyên liệu phù hợp" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Tên chuẩn</th><th>Tên gọi khác</th><th>Nhóm</th><th>Cần tránh</th><th>Thay thế</th><th className="num">Dùng trong</th><th>Trạng thái</th><th className="num">Thao tác</th></tr></thead>
          <tbody>{list.data!.items.map((i) => (
            <tr key={i._id}>
              <td><strong>{i.canonicalName}</strong></td>
              <td className="small">{i.aliases.join(', ') || '—'}</td>
              <td className="small">{groupLabel(i.groupId)}</td>
              <td>{i.avoidTags.map((t) => <Badge key={t} tone="warning">{t}</Badge>)}</td>
              <td className="small">{i.substitutionIds.map(nameOf).join(', ') || '—'}</td>
              <td className="num">{i.usageCount} món</td>
              <td>{i.status === 'active' ? <Badge tone="success">Đang dùng</Badge> : <Badge>Ngừng dùng</Badge>}</td>
              <td><div className="table-actions">
                <Button size="sm" icon="edit" onClick={() => setEditing(i)}>Sửa</Button>
                <Button size="sm" icon="swap" onClick={() => setSubFor(i)}>Thay thế</Button>
                <Button size="sm" variant="ghost" loading={busy === `st-${i._id}`} onClick={async () => { if (await run(`st-${i._id}`, () => adminService.setIngredientStatus(i._id, i.status === 'active' ? 'inactive' : 'active'), i.status === 'active' ? 'Đã chuyển sang ngừng sử dụng.' : 'Đã dùng lại nguyên liệu.')) reload(); }}>{i.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}</Button>
                <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Xóa ${i.canonicalName}`} onClick={() => setDel(i)} />
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      {editing && <IngredientForm ingredient={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {subFor && <SubstitutionForm ingredient={subFor} all={all.data?.items ?? []} onClose={() => setSubFor(null)} onSaved={() => { setSubFor(null); reload(); }} />}
      <ConfirmDialog open={!!del} title={`Xóa “${del?.canonicalName}”?`} danger confirmLabel="Xóa" loading={busy === 'del'}
        message={del && del.usageCount > 0 ? `Nguyên liệu đang được ${del.usageCount} công thức sử dụng nên hệ thống sẽ từ chối xóa cứng. Hãy chọn “Ngừng dùng”.` : 'Chỉ xóa được khi không còn công thức, danh sách thay thế hay hồ sơ người dùng tham chiếu.'}
        onCancel={() => setDel(null)} onConfirm={async () => { if (del && (await run('del', () => adminService.deleteIngredient(del._id), 'Đã xóa nguyên liệu.'))) { setDel(null); reload(); } }} />
    </div>
  );
}

function IngredientForm({ ingredient, onClose, onSaved }: { ingredient: IngredientRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(ingredient?.canonicalName ?? '');
  const [aliases, setAliases] = useState(ingredient?.aliases.join(', ') ?? '');
  const [group, setGroup] = useState(ingredient?.groupId ?? '');
  const [avoid, setAvoid] = useState(ingredient?.avoidTags.join(', ') ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const submit = async () => {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.canonicalName = 'Vui lòng nhập tên chuẩn.';
    if (!group) fe.groupId = 'Vui lòng chọn nhóm.';
    setErrors(fe);
    if (Object.keys(fe).length) return;
    const body = { canonicalName: name.trim(), aliases: aliases.split(',').map((x) => x.trim()).filter(Boolean), groupId: group, avoidTags: avoid.split(',').map((x) => x.trim()).filter(Boolean) };
    const r = await run('save', () => (ingredient ? adminService.updateIngredient(ingredient._id, body) : adminService.createIngredient(body)), ingredient ? 'Đã cập nhật nguyên liệu.' : 'Đã thêm nguyên liệu.', setErrors);
    if (r) onSaved();
  };
  return (
    <Modal open onClose={onClose} title={ingredient ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'} closeDisabled={!!busy} footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={submit} loading={busy === 'save'}>Lưu</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Tên chuẩn" required error={errors.canonicalName}><Input value={name} onChange={(e) => setName(e.target.value)} data-autofocus /></Field>
        <Field label="Tên gọi khác" hint="Phân tách bằng dấu phẩy, ví dụ: hành hoa, hành xanh" error={errors.aliases}><Input value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
        <Field label="Nhóm nguyên liệu" required error={errors.groupId}><Select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">– Chọn nhóm –</option>{INGREDIENT_GROUPS.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}</Select></Field>
        <Field label="Nhãn dị ứng / cần tránh" hint="Phân tách bằng dấu phẩy, ví dụ: hai-san, dau-phong, gluten"><Input value={avoid} onChange={(e) => setAvoid(e.target.value)} /></Field>
        {ingredient && ingredient.usageCount > 0 && <p className="subtle">Đổi tên chuẩn không ảnh hưởng liên kết của {ingredient.usageCount} công thức đang dùng.</p>}
      </form>
    </Modal>
  );
}

function SubstitutionForm({ ingredient, all, onClose, onSaved }: { ingredient: IngredientRow; all: IngredientRow[]; onClose: () => void; onSaved: () => void }) {
  const [items, setItems] = useState(ingredient.substitutionIds.map((id) => ({ ingredientId: id, note: ingredient.substitutionNotes?.[id] ?? '' })));
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { busy, run } = useAction();
  const options = all.filter((i) => i._id !== ingredient._id && !items.some((x) => x.ingredientId === i._id) && i.status === 'active');
  return (
    <Modal open onClose={onClose} title={`Nguyên liệu thay thế cho “${ingredient.canonicalName}”`} closeDisabled={!!busy} footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" loading={busy === 'save'} onClick={async () => { if (await run('save', () => adminService.setSubstitutions(ingredient._id, items), 'Đã lưu nguyên liệu thay thế.', (fe) => setError(Object.values(fe)[0]))) onSaved(); }}>Lưu</Button></>}>
      <div className="stack">
        <p className="subtle">Chỉ khai báo khi đã kiểm tra. Hệ thống không suy diễn món vẫn phù hợp chế độ ăn sau khi thay thế.</p>
        {error && <span className="field__error">{error}</span>}
        {items.length === 0 && <p className="muted">Chưa có nguyên liệu thay thế.</p>}
        {items.map((it, idx) => (
          <div key={it.ingredientId} className="row" style={{ alignItems: 'flex-end' }}>
            <strong style={{ minWidth: 120 }}>{all.find((a) => a._id === it.ingredientId)?.canonicalName}</strong>
            <Field label="Ghi chú khác biệt" className="grow"><Input value={it.note} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))} /></Field>
            <Button variant="ghost" iconOnly icon="trash" aria-label="Bỏ" onClick={() => setItems(items.filter((_, i) => i !== idx))} />
          </div>
        ))}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Thêm nguyên liệu thay thế" className="grow"><Select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">– Chọn –</option>{options.map((o) => <option key={o._id} value={o._id}>{o.canonicalName}</option>)}</Select></Field>
          <Button icon="plus" disabled={!pick} onClick={() => { setItems([...items, { ingredientId: pick, note: '' }]); setPick(''); }}>Thêm</Button>
        </div>
      </div>
    </Modal>
  );
}

// ======================= Đơn vị tính (UC58) =======================
export function UnitsAdminPage() {
  useDocumentTitle('Đơn vị tính');
  const list = useQuery(() => adminService.units(), []);
  const [editing, setEditing] = useState<UnitRow | 'new' | null>(null);
  const [del, setDel] = useState<UnitRow | null>(null);
  const { busy, run } = useAction();
  return (
    <div className="stack">
      <PageHeader title="Đơn vị tính" description="Không xóa đơn vị đang được công thức sử dụng; chuyển sang ngừng dùng để công thức cũ vẫn hiển thị đúng. Hệ thống không tự quy đổi giữa các đơn vị khác loại." actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Thêm đơn vị</Button>} />
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Tên</th><th>Ký hiệu</th><th className="num">Dùng trong</th><th>Trạng thái</th><th className="num">Thao tác</th></tr></thead>
          <tbody>{list.data!.items.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td><td><code>{u.symbol}</code></td><td className="num">{u.usageCount} món</td>
              <td>{u.status === 'active' ? <Badge tone="success">Đang dùng</Badge> : <Badge>Ngừng dùng</Badge>}</td>
              <td><div className="table-actions">
                <Button size="sm" icon="edit" onClick={() => setEditing(u)}>Sửa</Button>
                <Button size="sm" variant="ghost" loading={busy === u._id} onClick={async () => { if (await run(u._id, () => adminService.updateUnit(u._id, { status: u.status === 'active' ? 'inactive' : 'active' }), 'Đã cập nhật trạng thái.')) list.reload(); }}>{u.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}</Button>
                <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Xóa ${u.name}`} disabled={u.usageCount > 0} title={u.usageCount > 0 ? 'Đơn vị đang được dùng, không thể xóa' : undefined} onClick={() => setDel(u)} />
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {editing && <UnitForm unit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      <ConfirmDialog open={!!del} title={`Xóa đơn vị “${del?.name}”?`} danger confirmLabel="Xóa" loading={busy === 'del'} message="Đơn vị chưa được công thức nào sử dụng." onCancel={() => setDel(null)} onConfirm={async () => { if (del && (await run('del', () => adminService.deleteUnit(del._id), 'Đã xóa đơn vị.'))) { setDel(null); list.reload(); } }} />
    </div>
  );
}

function UnitForm({ unit, onClose, onSaved }: { unit: UnitRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(unit?.name ?? '');
  const [symbol, setSymbol] = useState(unit?.symbol ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const submit = async () => {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = 'Vui lòng nhập tên.';
    if (!symbol.trim()) fe.symbol = 'Vui lòng nhập ký hiệu.';
    setErrors(fe);
    if (Object.keys(fe).length) return;
    if (await run('save', () => (unit ? adminService.updateUnit(unit._id, { name, symbol }) : adminService.createUnit({ name, symbol })), 'Đã lưu đơn vị.', setErrors)) onSaved();
  };
  return (
    <Modal open onClose={onClose} title={unit ? 'Sửa đơn vị' : 'Thêm đơn vị'} footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={submit} loading={busy === 'save'}>Lưu</Button></>}>
      <form className="form-grid form-grid--2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Tên đơn vị" required error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="gram" data-autofocus /></Field>
        <Field label="Ký hiệu" required error={errors.symbol}><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="g" /></Field>
      </form>
    </Modal>
  );
}

// ======================= Danh mục (UC64–UC66) =======================
const CAT_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'mealSlot', label: 'Buổi ăn' }, { value: 'dishType', label: 'Loại món' }, { value: 'cuisine', label: 'Loại ẩm thực' }, { value: 'tag', label: 'Thẻ' },
];

export function CategoriesAdminPage() {
  useDocumentTitle('Danh mục');
  const catalog = useCatalog();
  const [type, setType] = useState<CategoryType>('mealSlot');
  const list = useQuery(() => adminService.categories(type), [type]);
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [hiding, setHiding] = useState<CategoryRow | null>(null);
  const { busy, run } = useAction();
  const done = () => { list.reload(); catalog.reload(); };
  return (
    <div className="stack">
      <PageHeader title="Danh mục" description="Buổi ăn, loại món, loại ẩm thực và thẻ dùng thống nhất trong bộ lọc và gợi ý." actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Thêm {CAT_TYPES.find((t) => t.value === type)!.label.toLowerCase()}</Button>} />
      <Tabs label="Loại danh mục" value={type} onChange={setType} tabs={CAT_TYPES} />
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Tên</th><th>Mã (slug)</th><th className="num">Thứ tự</th><th className="num">Số món</th><th>Trạng thái</th><th className="num">Thao tác</th></tr></thead>
          <tbody>{list.data!.items.map((c) => (
            <tr key={c._id}>
              <td><strong>{c.name}</strong></td><td><code>{c.slug}</code></td><td className="num">{c.displayOrder ?? '—'}</td><td className="num">{c.usageCount}</td>
              <td>{c.status === 'active' ? <Badge tone="success">Hiển thị</Badge> : <Badge>Đã ẩn</Badge>}</td>
              <td><div className="table-actions">
                <Button size="sm" icon="edit" onClick={() => setEditing(c)}>Sửa</Button>
                {c.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => setHiding(c)}>Ẩn</Button> : (
                  <Button size="sm" variant="ghost" loading={busy === c._id} onClick={async () => { if (await run(c._id, () => adminService.updateCategory(c._id, { status: 'active' }), 'Đã hiển thị lại danh mục.')) done(); }}>Hiển thị lại</Button>
                )}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {editing && <CategoryForm type={type} category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); done(); }} />}
      <ConfirmDialog open={!!hiding} title={`Ẩn “${hiding?.name}”?`} confirmLabel="Ẩn danh mục" danger loading={busy === 'hide'}
        message={hiding && hiding.usageCount > 0
          ? `${hiding.usageCount} món đang dùng danh mục này. Món không bị xóa nhưng danh mục sẽ không còn trong bộ lọc công khai và không gắn mới được.${hiding.type === 'mealSlot' ? ' Món chỉ thuộc buổi này sẽ không xuất hiện trong gợi ý theo buổi cho tới khi được chọn buổi khác.' : ''}`
          : 'Danh mục chưa được món nào sử dụng.'}
        onCancel={() => setHiding(null)} onConfirm={async () => { if (hiding && (await run('hide', () => adminService.updateCategory(hiding._id, { status: 'hidden' }), 'Đã ẩn danh mục.'))) { setHiding(null); done(); } }} />
    </div>
  );
}

function CategoryForm({ type, category, onClose, onSaved }: { type: CategoryType; category: CategoryRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [order, setOrder] = useState(category?.displayOrder?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const submit = async () => {
    if (!name.trim()) return setErrors({ name: 'Vui lòng nhập tên.' });
    const body = { type, name: name.trim(), slug: slug.trim() || undefined, displayOrder: order ? Number(order) : undefined };
    if (await run('save', () => (category ? adminService.updateCategory(category._id, body) : adminService.createCategory(body)), 'Đã lưu danh mục.', setErrors)) onSaved();
  };
  return (
    <Modal open onClose={onClose} title={category ? 'Sửa danh mục' : 'Thêm danh mục'} footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={submit} loading={busy === 'save'}>Lưu</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Tên hiển thị" required error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} data-autofocus /></Field>
        <Field label="Mã (slug)" hint="Để trống sẽ tạo từ tên. Không trùng trong cùng loại." error={errors.slug}><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></Field>
        <Field label="Thứ tự hiển thị" error={errors.displayOrder}><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} /></Field>
        {category && category.usageCount > 0 && <p className="subtle">Món tham chiếu bằng mã định danh nên đổi tên không cần sửa {category.usageCount} món đang dùng.</p>}
      </form>
    </Modal>
  );
}

