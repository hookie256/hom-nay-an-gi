import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui';

type Tone = 'info' | 'success' | 'error';
interface Toast { id: number; tone: Tone; message: ReactNode }
interface ToastApi { show: (message: ReactNode, tone?: Tone) => void; success: (m: ReactNode) => void; error: (m: ReactNode) => void }

const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((message: ReactNode, tone: Tone = 'info') => {
    const id = ++counter;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const api: ToastApi = { show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'success' ? 'checkCircle' : t.tone === 'error' ? 'alert' : 'info'} />
            <div>{t.message}</div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo"><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast phải nằm trong ToastProvider');
  return v;
}
