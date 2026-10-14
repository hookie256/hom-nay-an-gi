import type { Session, User } from '@/types/models';
import type { DbState } from './db';

export interface Ctx {
  db: DbState;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  token: string | null;
  now: Date;
  /** Được điền bởi optionalAuth/requireUser */
  user?: User;
  session?: Session;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler): void {
  routes.push({ method, parts: path.split('/').filter(Boolean), handler });
}

export function match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const segs = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}
