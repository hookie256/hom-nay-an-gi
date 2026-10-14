import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon } from './Icon';

type Variant = 'primary' | 'accent' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-outline';
type Size = 'sm' | 'md' | 'lg';

function cls(variant: Variant, size: Size, block?: boolean, iconOnly?: boolean, extra?: string) {
  return ['btn', variant !== 'secondary' && `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', iconOnly && 'btn--icon', extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: string;
  iconRight?: string;
  /** Nút chỉ có icon – bắt buộc truyền aria-label */
  iconOnly?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, icon, iconRight, iconOnly, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cls(variant, size, block, iconOnly, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 15 : 18} />}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', block, icon, iconRight, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; block?: boolean; icon?: string; iconRight?: string }) {
  return (
    <Link className={cls(variant, size, block, false, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 18} />}
    </Link>
  );
}
