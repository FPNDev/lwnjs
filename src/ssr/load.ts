import { whenSettled } from '../core/scope.ts';
import type { RouteMatch } from '../router/match.ts';
import type { Route } from '../router/types.ts';
import { setServerData } from './data.ts';
import { dataUrl, routeIds } from './payload.ts';

let dataRouteIds: number[] | undefined;
let suspended = false;
let generation = 0;

const nextTask = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

/**
 * Sets the current page data and releases it once the page has settled: after
 * the route actions ran (next task) and every outlet load finished. Only the
 * latest call releases.
 * @param next Page data.
 */
export async function provideServerData(next: Record<string, unknown>) {
  const current = ++generation;
  setServerData(next);
  await nextTask();
  await whenSettled();
  if (current === generation) {
    setServerData({});
  }
}

/**
 * Enables page data fetching for navigations after hydration.
 * @param ids Depth-first ids of routes with server data.
 */
export function enableServerData(ids: number[]) {
  dataRouteIds = ids;
}

/**
 * Pauses page data fetching while a server render runs in this process.
 * @param value Whether fetching is paused.
 */
export function suspendServerData(value: boolean) {
  suspended = value;
}

/**
 * Creates the router `load` hook that fetches a page's server data before
 * its route actions run. It stays inactive until `hydrate` finds a server
 * payload, so it never runs on the server, in client-only apps, or for the
 * first page (whose data is in the payload). It only fetches for routes that
 * have server data.
 * @param routes The app's route tree, the same one the server uses.
 * @returns The hook for `setupRouter(routes, { load })`.
 */
export function loadServerData(routes: readonly Route[]) {
  let dataRoutes: Set<Route> | undefined;
  let latest = 0;

  return async (match: RouteMatch, url: URL) => {
    if (!dataRouteIds || suspended) {
      return;
    }
    if (!dataRoutes) {
      const ids = routeIds(routes);
      dataRoutes = new Set(dataRouteIds.map((id) => ids[id]));
    }

    const request = ++latest;
    const hasData = match.chain.some(
      (route) =>
        dataRoutes!.has(route) ||
        (route.aliasOf !== undefined && dataRoutes!.has(route.aliasOf)),
    );
    let next: Record<string, unknown> = {};
    if (hasData) {
      const response = await fetch(dataUrl(url.pathname));
      if (!response.ok) {
        throw new Error(`Server data request failed with ${response.status}`);
      }
      next = (await response.json()) as Record<string, unknown>;
    }
    if (request === latest) {
      void provideServerData(next);
    }
  };
}
