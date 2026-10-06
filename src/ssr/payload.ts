import type { Route } from '../router/types.ts';

/** What the server embeds in the page for hydration. */
export type Payload = {
  /** Pathname the page was rendered for. */
  path: string;
  data: Record<string, unknown>;
  /**
   * For each render scope, the position of every created view by creation
   * index: a `childNodes` path from the container (`"0.2.1"`), several joined
   * by `|`, `~` before a placeholder of an empty text node, `null` when the
   * view was not in the page.
   */
  scopes: Record<string, (string | null)[]>;
  /** Depth-first ids of routes that have server data. */
  dataRoutes: number[];
};

export const PAYLOAD_ID = '__engine';

/**
 * Reads the payload embedded in the current document and removes its script
 * element, so the JSON text does not stay in the page.
 * @returns The payload, if any.
 */
export function takePayload(): Payload | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const script = document.querySelector(`#${PAYLOAD_ID}`);
  const text = script?.textContent;
  script?.remove();

  return text ? (JSON.parse(text) as Payload) : undefined;
}

/**
 * Lists routes depth-first, so an index is a stable route id on both server and client.
 * @param routes Route tree.
 * @param list Accumulator.
 * @returns Routes in depth-first order.
 */
export function routeIds(routes: readonly Route[], list: Route[] = []) {
  for (const route of routes) {
    list.push(route);
    if (route.children) {
      routeIds(route.children, list);
    }
  }

  return list;
}

/**
 * @param pathname Page pathname.
 * @returns The URL of the page's data, e.g. `/chat/42/__data.json`.
 */
export function dataUrl(pathname: string) {
  return `${pathname.endsWith('/') ? pathname : `${pathname}/`}__data.json`;
}
