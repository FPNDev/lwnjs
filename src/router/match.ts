import type { Route, RouteParams } from './types.ts';

type CompiledRoute = {
  route: Route;
  path: string | RegExp;
  chain: readonly Route[];
  children: CompiledRoute[];
};

export type RouteMatch = {
  /** Matched routes from root to leaf. */
  chain: readonly Route[];
  params: RouteParams;
};

type MatchResult = RouteMatch | undefined | Promise<RouteMatch | undefined>;

const escapeRegExp = (text: string) =>
  text.replaceAll(/[|\\{}()[\]^$+*?.]/gu, '\\$&');

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

  if (path === '') {
    return prefix;
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

  let flags = prefix instanceof RegExp ? prefix.flags : '';
  if (path instanceof RegExp) {
    for (const flag of path.flags) {
      if (!flags.includes(flag)) {
        flags += flag;
      }
    }
  }

  return new RegExp(`(?:${prefixSource})(?:${pathSource})`, flags);
}

/** Compiles route paths without mutating the route objects. */
export function compileRoutes(
  routes: readonly Route[],
  prefix: string | RegExp = '',
  parentChain: readonly Route[] = [],
): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];
  for (const route of routes) {
    const chain = [...parentChain, route];
    for (const alternative of (Array.isArray(route.path)
      ? route.path
      : [route.path]) as readonly (string | RegExp)[]) {
      const joined = joinPath(prefix, alternative);
      compiled.push({
        route,
        path:
          typeof joined === 'string'
            ? joined
            : new RegExp(`^${joined.source}\\/?`, joined.flags),
        chain,
        children: route.children
          ? compileRoutes(route.children, joined, chain)
          : [],
      });
    }
  }

  return compiled;
}

function matchSelf(
  node: CompiledRoute,
  full: boolean,
  params: RouteParams,
): MatchResult {
  if (!full) {
    return undefined;
  }
  const passed = node.route.guard ? node.route.guard(params) : true;
  if (passed instanceof Promise) {
    return passed.then((ok) => (ok ? { chain: node.chain, params } : undefined));
  }

  return passed ? { chain: node.chain, params } : undefined;
}

function matchChildren(
  node: CompiledRoute,
  pathname: string,
  full: boolean,
  params: RouteParams,
): MatchResult {
  // Prefer an index child so layouts can render their default page.
  const match = matchRoute(node.children, pathname);
  if (match instanceof Promise) {
    return match.then((found) => found ?? matchSelf(node, full, params));
  }

  return match ?? matchSelf(node, full, params);
}

/** Finds the first full route match whose guards pass. Returns a Promise only once a guard does. */
export function matchRoute(
  routes: readonly CompiledRoute[],
  pathname: string,
  start = 0,
): MatchResult {
  for (let index = start; index < routes.length; index++) {
    const node = routes[index];
    const { path } = node;
    let params: RouteParams = null;
    let end: number;
    if (typeof path === 'string') {
      end = pathname.startsWith(path) ? path.length : -1;
    } else {
      params = path.exec(pathname);
      end = params ? params[0].length : -1;
    }
    if (end < 0) {
      continue;
    }
    const full =
      end === pathname.length ||
      (end + 1 === pathname.length && pathname.codePointAt(end) === 47);
    if (
      !full &&
      !(
        node.children.length > 0 &&
        (pathname.codePointAt(end) === 47 ||
          pathname.codePointAt(end - 1) === 47)
      )
    ) {
      continue;
    }

    let found: MatchResult;
    if (node.children.length === 0) {
      found = matchSelf(node, full, params);
    } else {
      const gate = node.route.guardChildren
        ? node.route.guardChildren(params)
        : true;
      if (gate instanceof Promise) {
        found = gate.then((ok) =>
          ok
            ? matchChildren(node, pathname, full, params)
            : matchSelf(node, full, params),
        );
      } else {
        found = gate
          ? matchChildren(node, pathname, full, params)
          : matchSelf(node, full, params);
      }
    }

    if (found instanceof Promise) {
      return found.then(
        (match) => match ?? matchRoute(routes, pathname, index + 1),
      );
    }
    if (found) {
      return found;
    }
  }

  return undefined;
}
