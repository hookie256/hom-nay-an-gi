import { useState } from 'react';
import type { DishDetail } from '@/types/api';
import { Badge, Button, Icon, QuantityStepper } from '@/components/ui';
import { formatQuantity, scaleQuantity } from '@/domain/scaling';
import { INGREDIENT_GROUPS } from '@/domain/constants';

/** UC29–UC31: nguyên liệu, định lượng theo khẩu phần, nguyên liệu thay thế. */
export function IngredientsSection({ dish }: { dish: DishDetail }) {
  const [servings, setServings] = useState(dish.baseServings);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const required = dish.ingredients.filter((i) => i.required);
  const optional = dish.ingredients.filter((i) => !i.required);

  const renderRow = (i: DishDetail['ingredients'][number]) => (
    <li key={i.ingredientId} className="ing-row">
      <div className="ing-row__main">
        <span className="ing-row__name">{i.name}</span>
        {i.preparationNote && <span className="subtle"> – {i.preparationNote}</span>}
        {i.substitutes.length > 0 && (
          <Button size="sm" variant="ghost" icon="swap" aria-expanded={openSub === i.ingredientId} onClick={() => setOpenSub(openSub === i.ingredientId ? null : i.ingredientId)}>Thay thế</Button>
        )}
      </div>
      <span className="ing-row__qty">
        {i.unit ? <>{formatQuantity(scaleQuantity(i.quantity, dish.baseServings, servings, i.unit.symbol))} {i.unit.symbol}</> : <span className="subtle">Chưa có định lượng</span>}
      </span>
      {openSub === i.ingredientId && (
        <div className="ing-row__subs" role="region" aria-label={`Nguyên liệu thay thế cho ${i.name}`}>
          <ul>
            {i.substitutes.map((s) => <li key={s._id}><strong>{s.name}</strong>{s.note ? ` – ${s.note}` : ''}</li>)}
          </ul>
          <p className="subtle">Thay thế có thể làm thay đổi hương vị. Hệ thống không khẳng định món vẫn phù hợp chế độ ăn hoặc nguyên liệu cần tránh sau khi thay.</p>
        </div>
      )}
    </li>
  );

  return (
    <section className="card card__body stack" aria-labelledby="ing-title" id="nguyen-lieu">
      <div className="row-between">
        <h2 id="ing-title" className="h3" style={{ margin: 0 }}>Nguyên liệu</h2>
        <div className="row">
          <span className="small muted" id="servings-label">Khẩu phần</span>
          <QuantityStepper value={servings} onChange={setServings} min={1} max={50} label="Số khẩu phần" />
          {servings !== dish.baseServings && <Button size="sm" variant="ghost" onClick={() => setServings(dish.baseServings)}>Về {dish.baseServings}</Button>}
        </div>
      </div>
      <p className="subtle" aria-live="polite">
        {servings === dish.baseServings ? `Định lượng cho ${dish.baseServings} khẩu phần (công thức gốc).` : `Đã tính lại cho ${servings} khẩu phần từ công thức gốc ${dish.baseServings} khẩu phần; số lượng được làm tròn cho dễ đong.`}
      </p>
      <div>
        <h3 className="h4 row"><Badge tone="primary">Bắt buộc</Badge></h3>
        <ul className="ing-list">{required.map(renderRow)}</ul>
      </div>
      {optional.length > 0 && (
        <div>
          <h3 className="h4 row"><Badge>Tùy chọn</Badge></h3>
          <ul className="ing-list">{optional.map(renderRow)}</ul>
        </div>
      )}
      <details className="subtle">
        <summary>Nhóm nguyên liệu</summary>
        <p>{Array.from(new Set(dish.ingredients.map((i) => INGREDIENT_GROUPS.find((g) => g.code === i.groupId)?.label).filter(Boolean))).join(' · ')}</p>
      </details>
      <div className="nutrition">
        <h3 className="h4"><Icon name="info" size={16} /> Thông tin dinh dưỡng</h3>
        {dish.nutrition ? (
          <p className="small">
            {dish.nutrition.calories !== undefined && <>Năng lượng: {dish.nutrition.calories} kcal · </>}
            {dish.nutrition.proteinG !== undefined && <>Đạm: {dish.nutrition.proteinG} g · </>}
            {dish.nutrition.fatG !== undefined && <>Béo: {dish.nutrition.fatG} g · </>}
            {dish.nutrition.carbsG !== undefined && <>Tinh bột: {dish.nutrition.carbsG} g</>}
            <br /><span className="subtle">Tính cho {dish.baseServings} khẩu phần gốc. {dish.nutrition.basis}</span>
          </p>
        ) : (
          <p className="small muted">Chưa có dữ liệu dinh dưỡng đã được kiểm tra cho món này.</p>
        )}
      </div>
    </section>
  );
}
