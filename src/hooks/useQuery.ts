import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/services/apiClient';

export interface QueryState<T> {
  data: T | undefined;
  error: ApiRequestError | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Tải dữ liệu bất đồng bộ, bỏ qua phản hồi cũ khi tham số thay đổi (tránh race condition).
 * Giữ dữ liệu cũ trong lúc tải lại để giao diện không nhấp nháy.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], opts: { enabled?: boolean } = {}): QueryState<T> {
  const enabled = opts.enabled ?? true;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    fnRef.current()
      .then((d) => id === seq.current && setDataState(d))
      .catch((e) => id === seq.current && setError(e instanceof ApiRequestError ? e : new ApiRequestError(0, 'UNKNOWN', String(e?.message ?? e))))
      .finally(() => id === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((u: T | ((prev: T | undefined) => T)) => setDataState((prev) => (typeof u === 'function' ? (u as (p: T | undefined) => T)(prev) : u)), []);
  return { data, error, loading, reload, setData };
}
