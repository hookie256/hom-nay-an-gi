import { useEffect, useId, useRef, useState } from 'react';
import { Chip, Icon } from '@/components/ui';
import { catalogService, type IngredientOption } from '@/services';
import { useDebounce } from '@/hooks/misc';

/**
 * Ô tìm & chọn nguyên liệu chuẩn (combobox theo WAI-ARIA). Tìm được bằng tên gọi khác (RR02);
 * mỗi nguyên liệu chỉ chọn một lần (UC15).
 */
export function IngredientPicker({ selected, onChange, label, placeholder = 'Gõ tên nguyên liệu, ví dụ: trứng, cà chua…', max, exclude = [] }: {
  selected: IngredientOption[]; onChange: (next: IngredientOption[]) => void; label: string; placeholder?: string; max?: number; exclude?: string[];
}) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 200);
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogService.ingredients(debounced.trim() || undefined)
      .then((r) => !cancelled && setOptions(r.items.slice(0, 40)))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [debounced, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectedIds = new Set(selected.map((s) => s._id));
  const visible = options.filter((o) => !exclude.includes(o._id));
  const full = max !== undefined && selected.length >= max;

  const pick = (o: IngredientOption) => {
    if (selectedIds.has(o._id) || full) return;
    onChange([...selected, o]);
    setQ('');
    setActive(0);
  };

  return (
    <div className="stack-sm">
      <label htmlFor={inputId} className="field__label">{label}</label>
      <div className="combobox" ref={wrapRef}>
        <div className="input-group">
          <span className="input-group__icon"><Icon name="search" /></span>
          <input
            id={inputId}
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && visible[active] ? `${listId}-${visible[active]._id}` : undefined}
            placeholder={full ? `Đã chọn tối đa ${max} nguyên liệu` : placeholder}
            value={q}
            disabled={full}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, visible.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter' && open && visible[active]) { e.preventDefault(); pick(visible[active]); }
              else if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'Backspace' && !q && selected.length) onChange(selected.slice(0, -1));
            }}
          />
        </div>
        {open && !full && (
          <ul className="listbox" id={listId} role="listbox" aria-label="Gợi ý nguyên liệu">
            {loading && visible.length === 0 && <li className="listbox__empty">Đang tìm…</li>}
            {error && <li className="listbox__empty text-danger">{error}</li>}
            {!loading && !error && visible.length === 0 && (
              <li className="listbox__empty">Không tìm thấy “{q}”. Hãy thử tên gọi khác, ví dụ “đậu hũ” thay cho “đậu phụ”.</li>
            )}
            {visible.map((o, i) => {
              const chosen = selectedIds.has(o._id);
              return (
                <li
                  key={o._id}
                  id={`${listId}-${o._id}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={chosen}
                  className="listbox__option"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                >
                  <span>
                    {o.canonicalName}
                    {o.matchedAlias && <span className="subtle"> · còn gọi là “{o.matchedAlias}”</span>}
                  </span>
                  {chosen && <span className="subtle"><Icon name="check" size={14} /> Đã chọn</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selected.length > 0 && (
        <div className="row" aria-label="Nguyên liệu đã chọn">
          {selected.map((s) => (
            <Chip key={s._id} onRemove={() => onChange(selected.filter((x) => x._id !== s._id))} removeLabel={`Bỏ ${s.canonicalName}`}>
              {s.canonicalName}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
