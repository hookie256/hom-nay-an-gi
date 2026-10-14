import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';
import { Icon } from './Icon';

/**
 * Bao trường nhập liệu: nhãn, gợi ý và lỗi hiển thị ngay dưới trường (NFR20).
 * Tự gắn id, aria-invalid và aria-describedby cho phần tử con.
 */
export function Field({ label, hint, error, required, children, className, labelHidden }: {
  label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactElement; className?: string; labelHidden?: boolean;
}) {
  const autoId = useId();
  const id = (children.props as { id?: string }).id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })
    : children;
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'field__label'}>
        {label}
        {required && <span className="req" aria-hidden>*</span>}
      </label>
      {child}
      {hint && <span id={hintId} className="field__hint">{hint}</span>}
      {error && (
        <span id={errId} className="field__error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </span>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { size_?: 'sm' }>(function Input({ className, size_, ...rest }, ref) {
  return <input ref={ref} className={['input', size_ === 'sm' && 'input--sm', className].filter(Boolean).join(' ')} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={['select', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={['textarea', className].filter(Boolean).join(' ')} {...rest} />;
});

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="input-group">
      <span className="input-group__icon"><Icon name="search" /></span>
      <input type="search" className="input" {...props} />
    </div>
  );
}
