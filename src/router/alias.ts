import type { Route } from './types.ts';

function cloneRoute(route: Route): Route {
  return {
    ...route,
    aliasOf: route.aliasOf ?? route,
    children: route.children?.map(cloneRoute),
  };
}

/**
 * Serves a route tree under another path. Guards are kept, and listeners of
 * every original route (children included) fire for the aliased paths.
 * @param route Route tree to alias.
 * @param path Alternate path for the root route.
 * @returns The aliased route tree.
 */
export function aliasRoute(route: Route, path: string | RegExp): Route {
  return { ...cloneRoute(route), path };
}
