import type { Route, RouteParams } from './types.ts';

type CompiledRoute = {
  route: Route;
  path: string | RegExp;
  children: CompiledRoute[];
};

export type RouteMatch = {
  /** Matched routes from the top level down to the final match. */
  chain: Route[];
  params: RouteParams;
};

const escapeRegExp = (text: string) => text.replaceAll(/[|\\{}()[\]^$+*?.-]/gu, '\\$&');

function joinPath(prefix: string | RegExp, path: string | RegExp): string | RegExp {
  if (typeof prefix === 'string' && typeof path === 'string') {
    // An index route ('') matches its parent's exact path.
    if (!prefix || !path) {
      return prefix || path;
    }
    const prefixHasSlash = prefix.endsWith('/');
    const pathHasSlash = path.startsWith('/');
    if (prefixHasSlash && pathHasSlash) {
      return prefix + path.slice(1);
    }

    return prefixHasSlash || pathHasSlash ? prefix + path : prefix + '/' + path;
  }

  let prefixSource = typeof prefix === 'string' ? escapeRegExp(prefix) : prefix.source;
  let pathSource = path instanceof RegExp ? path.source : escapeRegExp(path);
  if (typeof path === 'string' && prefixSource) {
    pathSource = pathSource.replace(/^\//u, '');
    if (!prefixSource.endsWith('/')) {
      prefixSource += '\\/';
    }
  }

  const flags = (path instanceof RegExp ? path.flags : '') || (prefix instanceof RegExp ? prefix.flags : '');

  return new RegExp(`(?:${prefixSource})(?:${pathSource})`, flags);
}

/**
 * Compiles a route tree once. Route objects are not mutated, so one route
 * object can appear under several parents.
 * @param routes Routes to compile.
 * @param prefix Joined parent path.
 * @returns The compiled tree.
 */
export function compileRoutes(routes: readonly Route[], prefix: string | RegExp = ''): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];
  for (const route of routes) {
    const joined = joinPath(prefix, route.path);
    const path = typeof joined === 'string' ? joined : new RegExp(`^${joined.source}\\/?`, joined.flags);
    compiled.push({
      route,
      path,
      children: route.children ? compileRoutes(route.children, joined) : [],
    });
  }

  return compiled;
}

async function passes(check: unknown) {
  return Boolean(check instanceof Promise ? await check : check);
}

/**
 * Finds the first route that fully matches `pathname` and passes its guards.
 * Partial matches descend into children after `guardChildren` passes.
 * @param routes Compiled routes.
 * @param pathname Path to match.
 * @returns The match, or `undefined`.
 */
export async function matchRoute(routes: CompiledRoute[], pathname: string): Promise<RouteMatch | undefined> {
  for (const { route, path, children } of routes) {
    let partial: boolean;
    let full: boolean;
    let params: RouteParams = null;

    if (typeof path === 'string') {
      full = path === pathname || path + '/' === pathname;
      partial = !full && pathname.startsWith(path) && (path.endsWith('/') || pathname[path.length] === '/');
    } else {
      params = pathname.match(path);
      full = params?.[0] === pathname;
      partial = !full && params !== null;
    }

    if (full) {
      // An index child (path '') takes the exact match, so a layout can render it in its own outlet.
      if (children.length > 0 && (!route.guardChildren || (await passes(route.guardChildren(params))))) {
        const match = await matchRoute(children, pathname);
        if (match) {
          match.chain.unshift(route);

          return match;
        }
      }
      if (!route.guard || (await passes(route.guard(params)))) {
        return { chain: [route], params };
      }
      continue;
    }

    if (partial && children.length > 0 &&(!route.guardChildren || (await passes(route.guardChildren(params))))) {
      const match = await matchRoute(children, pathname);
      if (match) {
        match.chain.unshift(route);

        return match;
      }
    }
  }
}
