import { useId, useRef, useState, useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

export function Badge({ tone, children, icon }: { tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode; icon?: string }) {
  return (
    <span className={['badge', tone && `badge--${tone}`].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function Chip({ children, onRemove, removeLabel, active, onClick, ...rest }: {
  children: ReactNode; onRemove?: () => void; removeLabel?: string; active?: boolean; onClick?: () => void; 'aria-pressed'?: boolean;
}) {
  if (onRemove) {
    return (
      <span className="chip chip--static chip--active">
        {children}
        <button type="button" className="chip__remove" onClick={onRemove} aria-label={removeLabel ?? 'Bỏ'}>
          <Icon name="x" size={14} />
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={['chip', active && 'chip--active'].filter(Boolean).join(' ')} onClick={onClick} aria-pressed={rest['aria-pressed'] ?? active}>
      {children}
    </button>
  );
}

/** Nhóm lựa chọn dạng thanh trượt – radiogroup, điều hướng bằng phím mũi tên. */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: ReactNode; icon?: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, idx: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (idx + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="segmented__item"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          type="button"
          className="tab"
          aria-selected={t.value === value}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!dir) return;
            const n = (i + dir + tabs.length) % tabs.length;
            onChange(tabs[n].value);
            refs.current[n]?.focus();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <Button size="sm" icon="chevronLeft" onClick={() => onChange(page - 1)} disabled={page <= 1}>Trước</Button>
      <span className="pagination__info" aria-live="polite">Trang {page} / {pages} · {total} mục</span>
      <Button size="sm" iconRight="chevronRight" onClick={() => onChange(page + 1)} disabled={page >= pages}>Sau</Button>
    </nav>
  );
}

export function Stars({ value, size = 14, label }: { value: number; size?: number; label?: string }) {
  return (
    <span className="stars" role="img" aria-label={label ?? `${value.toLocaleString('vi-VN')} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: value >= i - 0.25 ? 1 : value >= i - 0.75 ? 0.55 : 0.22, display: 'flex' }}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

/** Chọn số sao 1–5 bằng radio (dùng được bằng bàn phím). */
export function RatingInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const labels = ['Rất tệ', 'Chưa ngon', 'Tạm được', 'Ngon', 'Rất ngon'];
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }} aria-invalid={!!error}>
      <legend className="field__label">Số sao <span className="req" aria-hidden>*</span></legend>
      <div className="row" onMouseLeave={() => setHover(0)}>
        <div className="stars stars--input">
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} onMouseEnter={() => setHover(i)}>
              <input className="star-radio" type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} aria-label={`${i} sao – ${labels[i - 1]}`} />
              <span className={['star-btn', (hover || value) >= i && 'on'].filter(Boolean).join(' ')}><Icon name="star" size={28} /></span>
            </label>
          ))}
        </div>
        <span className="muted small">{labels[(hover || value) - 1] ?? 'Chọn số sao'}</span>
      </div>
      {error && <span className="field__error" role="alert"><Icon name="alert" size={14} /> {error}</span>}
    </fieldset>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, label = 'Số lượng', disabled }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number.parseInt(draft, 10);
    if (Number.isInteger(n) && n >= min && n <= max) onChange(n);
    else setDraft(String(value)); // giá trị không hợp lệ → khôi phục giá trị trước (UC45)
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Giảm"><Icon name="minus" size={16} /></button>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        max={max}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Tăng"><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
