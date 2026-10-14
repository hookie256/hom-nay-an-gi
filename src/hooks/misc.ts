import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · Hôm Nay Ăn Gì?`;
  }, [title]);
}

/** Lưu trạng thái tiện ích của người xem (localStorage, có try/catch). */
export function usePersistentState<T>(key: string, initial: T, storage: 'local' | 'session' = 'local'): [T, (v: T | ((p: T) => T)) => void] {
  const store = () => {
    try {
      return storage === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  const [state, setState] = useState<T>(() => {
    try {
      const raw = store()?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      store()?.setItem(key, JSON.stringify(state));
    } catch {
      /* bỏ qua */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);
  return [state, setState];
}
