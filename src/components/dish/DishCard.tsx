import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DishCard as DishCardData } from '@/types/api';
import { Badge, Icon, Stars } from '@/components/ui';
import { DIFFICULTY_LABEL } from '@/domain/constants';
import { formatMinutes, formatPrice } from '@/utils/format';
import { DishImage } from './DishImage';
import { FavoriteButton } from './FavoriteButton';

/** Thẻ món: tên, ảnh, thời gian chế biến và (khi có) lý do gợi ý – NFR17. */
export function DishCard({ dish, recId, reasons, extra, footer, onOpen }: {
  dish: DishCardData; recId?: string; reasons?: string[]; extra?: ReactNode; footer?: ReactNode; onOpen?: () => void;
}) {
  const href = `/mon/${dish.slug}${recId ? `?rec=${recId}` : ''}`;
  return (
    <article className="dish-card card">
      <div className="dish-card__media">
        <Link to={href} tabIndex={-1} aria-hidden onClick={onOpen}>
          <DishImage src={dish.image} name={dish.name} className="dish-card__img" />
        </Link>
        {dish.selling?.orderable && <span className="dish-card__ribbon"><Icon name="store" size={13} /> Có bán</span>}
        {dish.isFavorite !== undefined && (
          <div className="dish-card__fav"><FavoriteButton dishId={dish._id} dishName={dish.name} initial={dish.isFavorite} size="sm" /></div>
        )}
      </div>
      <div className="dish-card__body">
        <h3 className="dish-card__title">
          <Link to={href} onClick={onOpen}>{dish.name}</Link>
        </h3>
        <div className="dish-card__meta">
          <span className="meta-item"><Icon name="clock" size={15} /> {formatMinutes(dish.totalMinutes)}</span>
          <span className="meta-item"><Icon name="flame" size={15} /> {DIFFICULTY_LABEL[dish.difficulty]}</span>
          {dish.rating ? (
            <span className="meta-item"><Stars value={dish.rating.avg} size={13} /> <span className="subtle">({dish.rating.count})</span></span>
          ) : (
            <span className="meta-item subtle">Chưa có đánh giá</span>
          )}
        </div>
        {extra}
        {reasons && reasons.length > 0 && (
          <details className="dish-card__reasons">
            <summary><Icon name="sparkles" size={14} /> Vì sao gợi ý món này?</summary>
            <ul>{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
        )}
        {dish.selling && (
          <div className="dish-card__price">
            {dish.selling.orderable ? <strong>{formatPrice(dish.selling.price)}</strong> : <Badge tone="warning">{dish.selling.reason}</Badge>}
          </div>
        )}
      </div>
      {footer && <div className="dish-card__footer">{footer}</div>}
    </article>
  );
}
