import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartView } from '@/types/api';
import { cartService } from '@/services';
import { useAuth } from './AuthContext';

interface CartApi {
  cart: CartView | null;
  count: number;
  refresh: () => Promise<void>;
  setCart: (c: CartView) => void;
}

const Ctx = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const refresh = useCallback(async () => {
    if (!user || user.role !== 'user') {
      setCart(null);
      return;
    }
    try {
      setCart(await cartService.get());
    } catch {
      /* lỗi tải giỏ không chặn giao diện; trang giỏ sẽ hiển thị lỗi riêng */
    }
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const count = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  return <Ctx.Provider value={{ cart, count, refresh, setCart }}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart phải nằm trong CartProvider');
  return v;
}
