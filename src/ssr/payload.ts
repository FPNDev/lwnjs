import type { Route } from '../router/types.ts';

/** Data embedded by the server for the initial client render. */
export type Payload = {
  /** Path rendered by the server. */
  path: string;
  data: Record<string, unknown>;
  /** Paths used to claim rendered views during hydration. */
  frames: Record<string, (string | null)[]>;
  /** Route ids with server data, in depth-first order. */
  dataRoutes: number[];
};

export const PAYLOAD_ID = '__engine';

/** Reads and removes the hydration payload script, if present. */
export function takePayload(): Payload | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const script = document.querySelector(`#${PAYLOAD_ID}`);
  const text = script?.textContent;
  script?.remove();

  return text ? (JSON.parse(text) as Payload) : undefined;
}

/** Flattens routes in a stable depth-first order. */
export function routeIds(routes: readonly Route[], list: Route[] = []) {
  for (const route of routes) {
    list.push(route);
    if (route.children) {
      routeIds(route.children, list);
    }
  }

  return list;
}

/** Returns the data endpoint for a page path. */
export function dataUrl(pathname: string) {
  return `${pathname.endsWith('/') ? pathname : `${pathname}/`}__data.json`;
}
