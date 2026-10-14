import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

export function Alert({ tone = 'info', title, children, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const icon = tone === 'success' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert';
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="alert__icon"><Icon name={icon} /></span>
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = 'search', title, children, action }: { icon?: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state" role="status">
      <div className="state__icon"><Icon name={icon} size={28} /></div>
      <p className="state__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Không tải được dữ liệu' }: { message?: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon"><Icon name="alert" size={28} /></div>
      <p className="state__title">{title}</p>
      {message && <p>{message}</p>}
      {onRetry && <Button icon="refresh" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner spinner--lg" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden />;
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-cards" aria-busy="true" aria-label="Đang tải danh sách món">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ overflow: 'hidden' }}>
          <Skeleton height={168} radius={0} />
          <div className="card__body stack-sm">
            <Skeleton height={20} width="70%" />
            <Skeleton height={14} width="45%" />
          </div>
        </div>
      ))}
    </div>
  );
}
