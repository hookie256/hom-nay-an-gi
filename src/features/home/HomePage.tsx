import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RecommendationItem, RecommendationResult } from '@/types/api';
import { Alert, Button, ButtonLink, CardSkeletonGrid, EmptyState, ErrorState, Icon, Segmented, Select, Tabs } from '@/components/ui';
import { DishCard } from '@/components/dish/DishCard';
import { recommendationService, catalogService } from '@/services';
import { currentMealSlot } from '@/domain/mealSlot';
import { DEFAULT_TIMEZONE, MEAL_SLOT_HOURS, MEAL_SLOT_SLUGS, type MealSlotSlug } from '@/domain/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle, usePersistentState } from '@/hooks/misc';
import { DishMarquee, HeroDeck, RotatingWord, SpinPicker, prefersReducedMotion } from './HeroBits';
import { useQuery } from '@/hooks/useQuery';

const SLOT_ICON: Record<MealSlotSlug, string> = { 'bua-sang': 'sunrise', 'bua-trua': 'sun', 'bua-chieu': 'sunset', 'bua-toi': 'moon' };
const TIME_OPTIONS = [0, 15, 30, 45, 60, 90];

export function HomePage() {
  useDocumentTitle('Gợi ý món theo buổi');
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const defaultSlot = currentMealSlot(new Date(), DEFAULT_TIMEZONE);
  const [slot, setSlot] = useState<MealSlotSlug>(defaultSlot);
  const [maxMinutes, setMaxMinutes] = usePersistentState<number>('hnag-home-max-minutes', 0, 'session');
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const marquee = useQuery(() => catalogService.dishes({ sort: 'relevance', pageSize: 24 }), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExhausted(null);
    recommendationService
      .get({ mode: 'meal', mealSlot: slot, maxMinutes: maxMinutes || undefined })
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [slot, maxMinutes, user?._id, tick]);

  const replace = async (item: RecommendationItem) => {
    if (!result) return;
    setReplacing(item.dish._id);
    try {
      const r = await recommendationService.replace(result.eventId, item.dish._id);
      if (r.item) {
        setResult({ ...result, items: result.items.map((x) => (x.dish._id === item.dish._id ? r.item! : x)) });
      } else {
        setExhausted(r.emptyReason ?? 'Đã hết món phù hợp.');
        setResult({ ...result, items: result.items.filter((x) => x.dish._id !== item.dish._id) });
        toast.show('Đã hết món phù hợp khác cho điều kiện hiện tại.');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReplacing(null);
    }
  };

  const choose = async (item: RecommendationItem) => {
    if (result) recommendationService.choose(result.eventId, item.dish._id).catch(() => undefined);
    navigate(`/mon/${item.dish.slug}?rec=${result?.eventId ?? ''}`);
  };

  const slotLabel = MEAL_SLOT_HOURS[slot].label;

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__text">
            <p className="hero__eyebrow"><Icon name={SLOT_ICON[defaultSlot]} size={16} /> Bây giờ là giờ {MEAL_SLOT_HOURS[defaultSlot].label.toLowerCase()}</p>
            <h1 className="hero__title">
              <span className="sr-only">Hôm nay ăn gì?</span>
              <span aria-hidden>Hôm nay ăn</span>
              <RotatingWord words={['gì', ...(result?.items.map((i) => i.dish.name) ?? [])]} />
            </h1>
            <p className="hero__lead">Chọn buổi ăn, hệ thống gợi ý món phù hợp kèm lý do. Không ưng thì bấm “Đổi món khác”.</p>
            <div className="hero__controls">
              <Segmented
                label="Chọn buổi ăn"
                value={slot}
                onChange={setSlot}
                options={MEAL_SLOT_SLUGS.map((s) => ({ value: s, label: capitalize(MEAL_SLOT_HOURS[s].label.replace('Bữa ', '')), icon: SLOT_ICON[s] }))}
              />
              <label className="inline-select">
                <Icon name="clock" size={16} />
                <span className="sr-only">Giới hạn thời gian nấu</span>
                <Select value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} aria-label="Giới hạn thời gian nấu">
                  {TIME_OPTIONS.map((m) => <option key={m} value={m}>{m ? `Tối đa ${m} phút` : 'Không giới hạn thời gian'}</option>)}
                </Select>
              </label>
            </div>
            <SpinPicker
              dishes={result?.items.map((i) => i.dish) ?? []}
              onPicked={(d) => {
                setPickedId(d._id);
                const el = document.getElementById(`rec-${d._id}`);
                el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
              }}
            />
            <Link to="/nguyen-lieu" className="hero__aside card">
              <span className="hero__aside-icon"><Icon name="carrot" size={22} /></span>
              <span>
                <strong>Có sẵn nguyên liệu trong bếp?</strong>
                <span className="muted small" style={{ display: 'block' }}>Nhập trứng, cà chua, hành… để xem món nấu được và thiếu gì.</span>
              </span>
              <Icon name="chevronRight" />
            </Link>
          </div>
          <HeroDeck dishes={result?.items.map((i) => i.dish) ?? []} recId={result?.eventId} />
        </div>
        <span className="hero__blob hero__blob--a" aria-hidden />
        <span className="hero__blob hero__blob--b" aria-hidden />
      </section>

      <DishMarquee dishes={marquee.data?.items ?? []} />

      <section className="container section" aria-labelledby="rec-title">
        <div className="row-between section__head">
          <h2 id="rec-title">Gợi ý cho {slotLabel.toLowerCase()}</h2>
          <Button icon="refresh" onClick={() => setTick((t) => t + 1)} disabled={loading}>Gợi ý lại</Button>
        </div>
        {user?.role === 'user' && result?.appliedProfile && (
          <Alert tone="info">Đang áp dụng chế độ ăn và nguyên liệu cần tránh trong <Link to="/tai-khoan/ho-so">hồ sơ của bạn</Link>.</Alert>
        )}
        {!user && <p className="subtle">Đăng nhập và thiết lập sở thích để gợi ý phù hợp với bạn hơn.</p>}
        {result && result.excludedNeedsVerification > 0 && (
          <p className="subtle"><Icon name="info" size={14} /> {result.excludedNeedsVerification} món bị bỏ qua vì thiếu dữ liệu thành phần, chưa thể khẳng định an toàn với nguyên liệu bạn cần tránh.</p>
        )}
        <div aria-live="polite" aria-busy={loading}>
          {loading && !result ? (
            <CardSkeletonGrid count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
          ) : result && result.items.length === 0 ? (
            <EmptyState icon="utensils" title="Chưa tìm thấy món phù hợp" action={
              <div className="row" style={{ justifyContent: 'center' }}>
                {maxMinutes > 0 && <Button onClick={() => setMaxMinutes(0)}>Bỏ giới hạn thời gian</Button>}
                <ButtonLink to="/kham-pha" variant="primary">Xem tất cả món</ButtonLink>
              </div>
            }>
              {result.emptyReason ?? exhausted}
            </EmptyState>
          ) : (
            <div className={['grid-cards', loading && 'is-refreshing'].filter(Boolean).join(' ')}>
              {result?.items.map((item, idx) => (
                <div key={item.dish._id} id={`rec-${item.dish._id}`} className={['card-enter', pickedId === item.dish._id && 'card-picked'].filter(Boolean).join(' ')} style={{ animationDelay: `${idx * 70}ms` }}>
                <DishCard
                  dish={item.dish}
                  recId={result.eventId}
                  reasons={item.reasons}
                  footer={
                    <>
                      <Button size="sm" icon="refresh" onClick={() => replace(item)} loading={replacing === item.dish._id} disabled={!!replacing && replacing !== item.dish._id}>Đổi món khác</Button>
                      <Button size="sm" variant="primary" onClick={() => choose(item)}>Chọn món này</Button>
                    </>
                  }
                />
                </div>
              ))}
            </div>
          )}
        </div>
        {exhausted && result && result.items.length > 0 && <Alert tone="warning">{exhausted}</Alert>}
      </section>

      <NewAndPopular />
    </>
  );
}

/** UC21 – Món mới / Phổ biến */
function NewAndPopular() {
  const [tab, setTab] = useState<'newest' | 'popular'>('newest');
  const q = useQuery(() => catalogService.dishes({ sort: tab, pageSize: 4 }), [tab]);
  return (
    <section className="container section" aria-labelledby="np-title">
      <div className="row-between section__head">
        <h2 id="np-title">Khám phá thêm</h2>
        <ButtonLink to={`/kham-pha?sort=${tab}`} variant="ghost" iconRight="chevronRight">Xem tất cả</ButtonLink>
      </div>
      <Tabs label="Nhóm món" value={tab} onChange={setTab} tabs={[{ value: 'newest', label: 'Món mới' }, { value: 'popular', label: 'Phổ biến' }]} />
      <div style={{ marginTop: 20 }}>
        {q.loading && !q.data ? <CardSkeletonGrid count={4} /> : q.error ? <ErrorState message={q.error.message} onRetry={q.reload} /> :
          q.data?.popularityUnavailable || q.data?.items.length === 0 ? (
            <EmptyState icon="chart" title="Chưa có dữ liệu phổ biến">Chỉ số phổ biến được tính từ lượt xem và lượt lưu trong 30 ngày gần nhất.</EmptyState>
          ) : (
            <div className="grid-cards">{q.data?.items.map((d) => <DishCard key={d._id} dish={d} />)}</div>
          )}
      </div>
    </section>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
