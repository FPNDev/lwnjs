import type { Route, RouteParams } from './types.ts';

type CompiledRoute = {
  route: Route;
  path: string | RegExp;
  children: CompiledRoute[];
};

export type RouteMatch = {
  /** Matched routes from root to leaf. */
  chain: Route[];
  params: RouteParams;
};

const escapeRegExp = (text: string) =>
  text.replaceAll(/[|\\{}()[\]^$+*?.-]/gu, '\\$&');

function joinPath(
  prefix: string | RegExp,
  path: string | RegExp,
): string | RegExp {
  if (typeof prefix === 'string' && typeof path === 'string') {
    // An empty child path is an index route for its parent.
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

  let prefixSource =
    typeof prefix === 'string' ? escapeRegExp(prefix) : prefix.source;
  let pathSource = path instanceof RegExp ? path.source : escapeRegExp(path);
  if (typeof path === 'string' && prefixSource) {
    pathSource = pathSource.replace(/^\//u, '');
    if (!prefixSource.endsWith('/')) {
      prefixSource += '\\/';
    }
  }

  const flags =
    (path instanceof RegExp ? path.flags : '') ||
    (prefix instanceof RegExp ? prefix.flags : '');

  return new RegExp(`(?:${prefixSource})(?:${pathSource})`, flags);
}

/** Compiles route paths without mutating the route objects. */
export function compileRoutes(
  routes: readonly Route[],
  prefix: string | RegExp = '',
): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];
  for (const route of routes) {
    const joined = joinPath(prefix, route.path);
    const path =
      typeof joined === 'string'
        ? joined
        : new RegExp(`^${joined.source}\\/?`, joined.flags);
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

/** Finds the first full route match whose guards pass. */
export async function matchRoute(
  routes: CompiledRoute[],
  pathname: string,
): Promise<RouteMatch | undefined> {
  for (const { route, path, children } of routes) {
    let partial: boolean;
    let full: boolean;
    let params: RouteParams = null;

    if (typeof path === 'string') {
      full = path === pathname || path + '/' === pathname;
      partial =
        !full &&
        pathname.startsWith(path) &&
        (path.endsWith('/') || pathname[path.length] === '/');
    } else {
      params = pathname.match(path);
      full = params?.[0] === pathname;
      partial = !full && params !== null;
    }

    if (full) {
      // Prefer an index child so layouts can render their default page.
      if (
        children.length > 0 &&
        (!route.guardChildren || (await passes(route.guardChildren(params))))
      ) {
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

    if (
      partial &&
      children.length > 0 &&
      (!route.guardChildren || (await passes(route.guardChildren(params))))
    ) {
      const match = await matchRoute(children, pathname);
      if (match) {
        match.chain.unshift(route);

        return match;
      }
    }
  }
}
