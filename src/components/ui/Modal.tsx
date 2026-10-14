import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

/**
 * Hộp thoại có bẫy focus, đóng bằng Esc, trả focus về phần tử mở (accessibility).
 */
export function Modal({ open, onClose, title, children, footer, size, closeDisabled }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'lg'; closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const lastFocus = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const node = ref.current!;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
    (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[1] ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (f.length === 0) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, closeDisabled]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !closeDisabled && onClose()}>
      <div ref={ref} className={['modal', size === 'lg' && 'modal--lg'].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" iconOnly icon="x" aria-label="Đóng" onClick={onClose} disabled={closeDisabled} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger, loading, onConfirm, onCancel, children }: {
  open: boolean; title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      closeDisabled={loading}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>{confirmLabel}</Button>
        </>
      }
    >
      {message && <div className="muted">{message}</div>}
      {children}
    </Modal>
  );
}
