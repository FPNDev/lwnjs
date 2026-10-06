import { requireOwner, runInFrame } from '../core/owner.ts';
import { withScope } from '../core/scope.ts';
import { onDestroy } from '../core/tree.ts';
import { browserHistory, memoryHistory, type History } from './history.ts';
import { compileRoutes, matchRoute, type RouteMatch } from './match.ts';
import type { Route, RouteParams } from './types.ts';

export type RouteAction = (
  previousRoute: Route | undefined,
  previousLocation: URL | undefined,
) => unknown;

type RouteListener = {
  owner: object;
  action: RouteAction;
  /** Navigation id this listener last ran for, so it runs once per navigation. */
  ranFor: number;
};

export type RouterOptions = {
  /** URL source. Defaults to the browser history, or memory history where there is no `window`. */
  history?: History;
  /** Runs after a match and before route actions, e.g. to fetch the page's server data. */
  load?: (match: RouteMatch, url: URL) => unknown;
};

/**
 * Creates a router and runs the initial navigation.
 * @param routes Route tree, matched in order.
 * @param options Router options.
 * @returns Router API.
 */
export function setupRouter(
  routes: readonly Route[],
  options: RouterOptions = {},
) {
  const history =
    options.history ??
    (typeof window === 'undefined' ? memoryHistory() : browserHistory());
  const compiled = compileRoutes(routes);
  const listeners = new Map<Route, Set<RouteListener>>();

  let requested = 0;
  let completed = 0;
  let activeChain: Route[] = [];
  let activeRoutes = new Set<Route>();
  let activeLocation: URL | undefined;
  let previousRoute: Route | undefined;
  let previousLocation: URL | undefined;
  let params: RouteParams = null;

  const run = (listener: RouteListener, pending: unknown[]) => {
    if (listener.ranFor === completed) {
      return;
    }
    listener.ranFor = completed;
    // Actions run in their owner's frame: owner-less calls inside them belong to it.
    const result = runInFrame(listener.owner, () =>
      listener.action(previousRoute, previousLocation),
    );
    if (result instanceof Promise) {
      pending.push(result);
    }
  };

  /** Runs the active chain's actions synchronously, in a render scope. */
  const dispatch = () => {
    const pending: unknown[] = [];
    withScope('', () => {
      for (const route of activeChain) {
        for (const listener of listeners.get(route) ?? []) {
          run(listener, pending);
        }
        if (route.aliasOf) {
          for (const listener of listeners.get(route.aliasOf) ?? []) {
            run(listener, pending);
          }
        }
      }
    });

    return Promise.all(pending);
  };

  const navigate = async () => {
    const url = history.location();
    if (
      activeLocation &&
      activeLocation.pathname + activeLocation.search ===
        url.pathname + url.search
    ) {
      return;
    }

    const id = ++requested;
    const match = await matchRoute(compiled, url.pathname);
    if (id !== requested) {
      return;
    }
    if (match && options.load) {
      await options.load(match, url);
      if (id !== requested) {
        return;
      }
    }
    if (!match) {
      // Nothing changes, but listeners registered while matching still get the current route.
      completed = id;
      await dispatch();

      return;
    }

    previousRoute = activeChain.at(-1);
    previousLocation = activeLocation;
    activeLocation = url;
    activeChain = match.chain;
    activeRoutes = new Set(match.chain);
    for (const route of match.chain) {
      if (route.aliasOf) {
        activeRoutes.add(route.aliasOf);
      }
    }
    params = match.params && Object.freeze(match.params);
    completed = id;
    await dispatch();
  };

  /**
   * Runs `action` whenever one of `routes` is in the active chain: the final
   * match or one of its parents. Runs right away if one already is. Ends when
   * `owner` is destroyed.
   */
  const onRoutes = (
    owner: object,
    routeList: readonly Route[],
    action: RouteAction,
  ) => {
    const listener: RouteListener = { owner, action, ranFor: -1 };
    for (const route of routeList) {
      let set = listeners.get(route);
      if (!set) {
        set = new Set();
        listeners.set(route, set);
      }
      set.add(listener);
    }

    const remove = () => {
      for (const route of routeList) {
        listeners.get(route)?.delete(listener);
      }
    };
    const unregister = onDestroy(owner, remove);

    if (
      requested === completed &&
      routeList.some((route) => activeRoutes.has(route))
    ) {
      run(listener, []);
    }

    return () => {
      unregister();
      remove();
    };
  };

  const unlisten = history.listen(() => void navigate());
  const ready = navigate();

  return {
    /** Resolves after the initial navigation. */
    ready,
    /** Matches `pathname` without navigating. Runs guards. */
    match(pathname: string) {
      return matchRoute(compiled, pathname);
    },
    /** Pushes `url` and resolves after the route actions (and the promises they return) settle. */
    go(url: string) {
      history.push(url);

      return navigate();
    },
    getPath() {
      return history.location().pathname;
    },
    getParams() {
      return params;
    },
    /** Runs `action` while any of `routes` is active. Without `owner`: the current owner. */
    routes(
      ...args:
        | [readonly Route[], RouteAction]
        | [object, readonly Route[], RouteAction]
    ) {
      return args.length === 2
        ? onRoutes(requireOwner('router.routes'), ...args)
        : onRoutes(...args);
    },
    /** Runs `action` while `route` is active. Without `owner`: the current owner. */
    route(...args: [Route, RouteAction] | [object, Route, RouteAction]) {
      return args.length === 2
        ? onRoutes(requireOwner('router.route'), [args[0]], args[1])
        : onRoutes(args[0], [args[1]], args[2]);
    },
    /** Stops listening to history and drops every listener. */
    dispose() {
      unlisten();
      listeners.clear();
    },
  };
}

export type Router = ReturnType<typeof setupRouter>;
