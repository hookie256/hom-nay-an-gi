import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import type { UserProfile } from '@/types/models';
import { Alert, Button, Checkbox, Chip, ErrorState, Field, Input, Loading, PageHeader, Switch } from '@/components/ui';
import { IngredientPicker } from '@/components/dish/IngredientPicker';
import { catalogService, profileService, type IngredientOption } from '@/services';
import { ApiRequestError } from '@/services/apiClient';
import { useCatalog } from '@/contexts/CatalogContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { DIETS, TASTES } from '@/domain/constants';

/** UC07–UC10: hồ sơ, sở thích, chế độ ăn & nguyên liệu cần tránh, thời gian nấu, tùy chọn lưu lịch sử. */
export function ProfilePage() {
  useDocumentTitle('Hồ sơ & sở thích');
  const location = useLocation();
  const q = useQuery(async () => {
    const [p, ings] = await Promise.all([profileService.get(), catalogService.ingredients()]);
    return { ...p, ingredients: ings.items };
  }, []);
  const welcome = (location.state as { welcome?: boolean } | null)?.welcome;

  useEffect(() => {
    if (location.pathname.endsWith('so-thich') && q.data) document.getElementById('so-thich')?.scrollIntoView({ block: 'start' });
  }, [location.pathname, q.data]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorState message={q.error.message} onRetry={q.reload} />;
  const { profile, email, ingredients } = q.data!;
  return (
    <div className="stack">
      <PageHeader title="Hồ sơ & sở thích" description="Thông tin này giúp hệ thống xếp hạng và lọc món phù hợp với bạn." />
      {welcome && <Alert tone="success" title="Chào mừng bạn!">Hãy chọn vài sở thích để nhận gợi ý phù hợp hơn. Bạn có thể bỏ qua và cập nhật sau.</Alert>}
      <BasicSection profile={profile} email={email} onSaved={q.reload} />
      <PreferenceSection profile={profile} onSaved={q.reload} />
      <DietSection profile={profile} allIngredients={ingredients} onSaved={q.reload} />
      <CookTimeSection profile={profile} onSaved={q.reload} />
    </div>
  );
}

function useSave(onSaved: () => void, successMsg: string) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async (patch: Partial<UserProfile>) => {
    setBusy(true);
    setErrors({});
    try {
      await profileService.update(patch);
      toast.success(successMsg);
      onSaved();
      if ('displayName' in patch) void refreshUser();
      return true;
    } catch (e) {
      // Lỗi: giữ nguyên thông tin đã lưu, hiển thị lỗi cạnh trường
      if (e instanceof ApiRequestError && e.fieldErrors) setErrors(e.fieldErrors);
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, setErrors, save };
}

function BasicSection({ profile, email, onSaved }: { profile: UserProfile; email: string; onSaved: () => void }) {
  const [name, setName] = useState(profile.displayName ?? '');
  const [saveHistory, setSaveHistory] = useState(profile.saveHistory);
  const { busy, errors, setErrors, save } = useSave(onSaved, 'Đã lưu hồ sơ.');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErrors({ displayName: 'Tên hiển thị không được để trống.' });
    void save({ displayName: name.trim(), saveHistory });
  };
  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="basic-title">
      <div className="card__header"><h2 id="basic-title" className="h3">Thông tin tài khoản</h2></div>
      <div className="card__body stack">
        <div className="form-grid form-grid--2">
          <Field label="Tên hiển thị" required error={errors.displayName}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="Email" hint="Email dùng để đăng nhập, không thể thay đổi ở đây."><Input value={email} disabled readOnly /></Field>
        </div>
        <Switch label="Cho phép lưu lịch sử xem món và gợi ý để cá nhân hóa" checked={saveHistory} onChange={(e) => setSaveHistory(e.target.checked)} />
        <p className="subtle" style={{ margin: 0 }}>Khi tắt, hệ thống ngừng ghi hoạt động mới. Bạn có thể xem hoặc xóa lịch sử đã lưu trong mục “Lịch sử hoạt động”.</p>
      </div>
      <div className="card__footer form-actions"><Button type="submit" variant="primary" loading={busy}>Lưu</Button></div>
    </form>
  );
}

function PreferenceSection({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const catalog = useCatalog();
  const [tastes, setTastes] = useState(profile.tastes);
  const [cats, setCats] = useState(profile.favoriteCategoryIds);
  const [cuisines, setCuisines] = useState(profile.cuisineIds);
  const { busy, errors, save } = useSave(onSaved, 'Đã lưu sở thích.');
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <form className="card" id="so-thich" onSubmit={(e) => { e.preventDefault(); void save({ tastes, favoriteCategoryIds: cats, cuisineIds: cuisines }); }} aria-labelledby="pref-title">
      <div className="card__header"><h2 id="pref-title" className="h3">Sở thích ăn uống</h2></div>
      <div className="card__body stack">
        <p className="subtle" style={{ margin: 0 }}>Sở thích chỉ giúp đưa món phù hợp lên trước, không loại bỏ các món khác.</p>
        <fieldset className="filter-group"><legend>Khẩu vị</legend>
          <div className="row">{TASTES.map((t) => <Chip key={t.code} active={tastes.includes(t.code)} onClick={() => toggle(tastes, setTastes, t.code)}>{t.label}</Chip>)}</div>
          {errors.tastes && <span className="field__error">{errors.tastes}</span>}
        </fieldset>
        <fieldset className="filter-group"><legend>Loại món yêu thích</legend>
          <div className="row">{catalog.byType('dishType').map((c) => <Chip key={c._id} active={cats.includes(c._id)} onClick={() => toggle(cats, setCats, c._id)}>{c.name}</Chip>)}</div>
          {errors.favoriteCategoryIds && <span className="field__error">{errors.favoriteCategoryIds}</span>}
        </fieldset>
        <fieldset className="filter-group"><legend>Loại ẩm thực yêu thích</legend>
          <div className="row">{catalog.byType('cuisine').map((c) => <Chip key={c._id} active={cuisines.includes(c._id)} onClick={() => toggle(cuisines, setCuisines, c._id)}>{c.name}</Chip>)}</div>
          {errors.cuisineIds && <span className="field__error">{errors.cuisineIds}</span>}
        </fieldset>
      </div>
      <div className="card__footer form-actions"><Button type="submit" variant="primary" loading={busy}>Lưu sở thích</Button></div>
    </form>
  );
}

function DietSection({ profile, allIngredients, onSaved }: { profile: UserProfile; allIngredients: IngredientOption[]; onSaved: () => void }) {
  const byId = useMemo(() => new Map(allIngredients.map((i) => [i._id, i])), [allIngredients]);
  const [diets, setDiets] = useState(profile.dietCodes);
  const [avoid, setAvoid] = useState<IngredientOption[]>(profile.avoidedIngredientIds.map((id) => byId.get(id)).filter((x): x is IngredientOption => !!x));
  const { busy, errors, save } = useSave(onSaved, 'Đã lưu chế độ ăn và nguyên liệu cần tránh.');
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save({ dietCodes: diets, avoidedIngredientIds: avoid.map((a) => a._id) }); }} aria-labelledby="diet-title">
      <div className="card__header"><h2 id="diet-title" className="h3">Chế độ ăn & nguyên liệu cần tránh</h2></div>
      <div className="card__body stack">
        <Alert tone="warning">Món chứa nguyên liệu cần tránh sẽ bị <strong>loại khỏi</strong> gợi ý và bộ lọc. Món chưa đủ dữ liệu thành phần cũng không được coi là an toàn. Thông tin chỉ mang tính hỗ trợ, không thay thế tư vấn y tế khi bạn bị dị ứng.</Alert>
        <fieldset className="filter-group"><legend>Chế độ ăn</legend>
          {DIETS.map((d) => <Checkbox key={d.code} label={d.label} checked={diets.includes(d.code)} onChange={() => setDiets(diets.includes(d.code) ? diets.filter((x) => x !== d.code) : [...diets, d.code])} />)}
          {errors.dietCodes && <span className="field__error">{errors.dietCodes}</span>}
        </fieldset>
        <IngredientPicker label="Nguyên liệu cần tránh" placeholder="Ví dụ: tôm, lạc, sữa…" selected={avoid} onChange={setAvoid} />
        {errors.avoidedIngredientIds && <span className="field__error">{errors.avoidedIngredientIds}</span>}
      </div>
      <div className="card__footer form-actions"><Button type="submit" variant="primary" loading={busy}>Lưu</Button></div>
    </form>
  );
}

function CookTimeSection({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const [value, setValue] = useState(profile.preferredCookMinutes ? String(profile.preferredCookMinutes) : '');
  const { busy, errors, setErrors, save } = useSave(onSaved, 'Đã lưu thời gian nấu mong muốn.');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value === '') return void save({ preferredCookMinutes: null as unknown as undefined });
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0 || n > 600) return setErrors({ preferredCookMinutes: 'Nhập số phút là số nguyên dương, tối đa 600.' });
    void save({ preferredCookMinutes: n });
  };
  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="time-title">
      <div className="card__header"><h2 id="time-title" className="h3">Thời gian nấu mong muốn</h2></div>
      <div className="card__body stack">
        <Field label="Tổng thời gian tối đa (sơ chế + nấu), phút" error={errors.preferredCookMinutes} hint="Dùng để ưu tiên món nấu nhanh hơn khi xếp hạng. Để trống nếu không giới hạn.">
          <Input type="number" inputMode="numeric" min={1} max={600} value={value} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>
      </div>
      <div className="card__footer form-actions"><Button type="submit" variant="primary" loading={busy}>Lưu</Button></div>
    </form>
  );
}
