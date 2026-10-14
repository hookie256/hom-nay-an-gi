import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DishDetail } from '@/types/api';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, Icon, Loading, QuantityStepper, Stars } from '@/components/ui';
import { DishImage } from '@/components/dish/DishImage';
import { DishCard } from '@/components/dish/DishCard';
import { FavoriteButton } from '@/components/dish/FavoriteButton';
import { cartService, catalogService } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { DIFFICULTY_LABEL } from '@/domain/constants';
import { formatMinutes, formatPrice } from '@/utils/format';
import { IngredientsSection } from './IngredientsSection';
import { StepsSection } from './StepsSection';
import { ReviewsSection } from './ReviewsSection';

/** UC26–UC28 (+ UC29–UC40, UC44): trang chi tiết món. */
export function DishDetailPage() {
  const { slug = '' } = useParams();
  const [search] = useSearchParams();
  const recId = search.get('rec') ?? undefined;
  const q = useQuery(() => catalogService.dish(slug), [slug]);
  const dish = q.data;
  useDocumentTitle(dish?.name ?? (q.error ? 'Món không khả dụng' : 'Đang tải món'));
  const stepsRef = useRef<HTMLElement>(null);

  // Ghi nhận lượt mở trang chi tiết (một lần mỗi lần mở)
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!dish || logged.current === dish._id) return;
    logged.current = dish._id;
    catalogService.logView(dish._id, recId).catch(() => undefined);
  }, [dish, recId]);

  if (q.loading && !dish) return <div className="container page"><Loading label="Đang tải thông tin món" /></div>;
  if (q.error) {
    return (
      <div className="container page">
        {q.error.status === 404 ? (
          <EmptyState icon="utensils" title="Món ăn không khả dụng" action={<ButtonLink to="/kham-pha" variant="primary">Khám phá món khác</ButtonLink>}>
            Món này không tồn tại hoặc đã được ẩn khỏi trang công khai.
          </EmptyState>
        ) : <ErrorState message={q.error.message} onRetry={q.reload} />}
      </div>
    );
  }
  if (!dish) return null;
  const total = dish.prepMinutes + dish.cookMinutes;

  const scrollToSteps = () => {
    stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    stepsRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="container page dish-page">
      <nav aria-label="Đường dẫn" className="breadcrumb">
        <Link to="/">Trang chủ</Link> <Icon name="chevronRight" size={14} /> <Link to="/kham-pha">Khám phá</Link> <Icon name="chevronRight" size={14} /> <span aria-current="page">{dish.name}</span>
      </nav>

      <section className="dish-hero">
        <div className="dish-hero__media">
          <DishImage src={dish.images[0]} name={dish.name} className="dish-hero__img" eager />
        </div>
        <div className="dish-hero__info stack">
          <div className="row">
            {dish.mealSlots.map((c) => <Badge key={c._id} tone="primary">{c.name}</Badge>)}
            {dish.categories.map((c) => <Badge key={c._id}>{c.name}</Badge>)}
            {dish.cuisines.map((c) => <Badge key={c._id} tone="info">{c.name}</Badge>)}
          </div>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <h1 style={{ margin: 0 }}>{dish.name}</h1>
            <FavoriteButton dishId={dish._id} dishName={dish.name} initial={dish.isFavorite} withLabel />
          </div>
          <div className="row">
            {dish.rating ? <><Stars value={dish.rating.avg} /><a href="#danh-gia" className="small">{dish.rating.avg.toLocaleString('vi-VN')} · {dish.rating.count} đánh giá</a></> : <span className="muted small">Chưa có đánh giá</span>}
          </div>
          {dish.description && <p className="lead">{dish.description}</p>}
          <dl className="dish-facts">
            <div><dt>Khẩu phần</dt><dd>{dish.baseServings} người</dd></div>
            <div><dt>Độ khó</dt><dd>{DIFFICULTY_LABEL[dish.difficulty]}</dd></div>
            <div><dt>Sơ chế</dt><dd>{formatMinutes(dish.prepMinutes)}</dd></div>
            <div><dt>Nấu</dt><dd>{formatMinutes(dish.cookMinutes)}</dd></div>
            <div><dt>Tổng thời gian</dt><dd>{formatMinutes(total)}</dd></div>
          </dl>
          <div className="dish-actions">
            <Button variant="accent" size="lg" icon="book" onClick={scrollToSteps}>Xem cách nấu</Button>
            {dish.selling?.orderable && <a href="#dat-mon" className="btn btn--primary btn--lg"><Icon name="cart" /> Đặt món</a>}
          </div>
          <OrderBox dish={dish} />
        </div>
      </section>

      <div className="dish-body">
        <IngredientsSection dish={dish} />
        <StepsSection dish={dish} ref={stepsRef} />
      </div>

      <ReviewsSection dish={dish} onRatingChanged={q.reload} />

      {dish.related.length > 0 && (
        <section className="section" aria-labelledby="related-title">
          <h2 id="related-title">Món liên quan</h2>
          <div className="grid-cards">{dish.related.map((d) => <DishCard key={d._id} dish={d} />)}</div>
        </section>
      )}
      {dish.source && <p className="subtle">Nguồn: {dish.source}</p>}
    </div>
  );
}

/** UC28 → UC44: phần đặt món chỉ hiện khi món có trong thực đơn bán hàng. */
function OrderBox({ dish }: { dish: DishDetail }) {
  const { user } = useAuth();
  const { setCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const s = dish.selling;
  if (!s) return <p className="subtle"><Icon name="info" size={14} /> Món này chỉ có công thức tham khảo, hiện không bán trên website.</p>;

  const hours = s.receivingHours.map((h) => `${h.start}–${h.end}`).join(', ');
  const add = async (goToCart: boolean) => {
    if (!user) {
      navigate(`/dang-nhap?next=${encodeURIComponent(location.pathname)}`, { state: { reason: 'Đăng nhập để đặt món.' } });
      return;
    }
    setBusy(true);
    try {
      setCart(await cartService.add(dish._id, qty));
      toast.success(`Đã thêm ${qty} phần “${dish.name}” vào giỏ.`);
      if (goToCart) navigate('/gio-hang');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="order-box" id="dat-mon">
      <div className="row-between">
        <div>
          <div className="order-box__price">{formatPrice(s.price, s.currency)} <span className="subtle">/ phần</span></div>
          <div className="small">
            {s.orderable ? <span className="text-success"><Icon name="checkCircle" size={14} /> Đang nhận đơn</span> : <span className="text-danger"><Icon name="alert" size={14} /> {s.reason}</span>}
            <span className="muted"> · Giờ nhận đơn: {hours}</span>
          </div>
        </div>
        {s.orderable && user?.role !== 'admin' && user?.role !== 'super_admin' && (
          <div className="row">
            <QuantityStepper value={qty} onChange={setQty} min={1} max={20} />
            <Button variant="primary" icon="cart" onClick={() => add(false)} loading={busy}>Thêm vào giỏ</Button>
          </div>
        )}
      </div>
      {s.orderable && (user?.role === 'admin' || user?.role === 'super_admin') && <p className="subtle" style={{ margin: 0 }}>Tài khoản quản trị không đặt món.</p>}
      <p className="subtle" style={{ margin: 0 }}>Giá trong giỏ là tạm tính và được kiểm tra lại khi bạn xác nhận đặt hàng.</p>
    </div>
  );
}
