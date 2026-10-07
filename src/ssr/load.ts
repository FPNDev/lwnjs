import { whenSettledHydration } from '../core/hydration.ts';
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

/** Sets page data and schedules its release after the current navigation settles. */
export async function provideServerData(next: Record<string, unknown>) {
  const current = ++generation;
  setServerData(next);
  await nextTask();
  await whenSettledHydration();
  if (current === generation) {
    setServerData({});
  }
}

/** Enables client data loading for routes in the hydration payload. */
export function enableServerData(ids: number[]) {
  dataRouteIds = ids;
}

/** Pauses client data loading during server rendering. */
export function suspendServerData(value: boolean) {
  suspended = value;
}

/** Creates a router loader for server data on client navigations. */
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
