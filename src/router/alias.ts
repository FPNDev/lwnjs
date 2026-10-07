import type { Route } from './types.ts';

function cloneRoute(route: Route): Route {
  return {
    ...route,
    aliasOf: route.aliasOf ?? route,
    children: route.children?.map(cloneRoute),
  };
}

/** Clones a route tree under another path and preserves its route listeners. */
export function aliasRoute(route: Route, path: string | RegExp): Route {
  return { ...cloneRoute(route), path };
}
