import { requireOwner, runInFrame } from '../core/owner.ts';
import { withScope } from '../core/scope.ts';
import { onDestroy } from '../core/tree.ts';
import { browserHistory, memoryHistory, type History } from './history.ts';
import { compileRoutes, matchRoute, type RouteMatch } from './match.ts';
import type { Route, RouteParams } from './types.ts';

type NavigationAction = () => void;
type NavigationListener<T = NavigationAction> = {
  owner: object;
  action: T;
};

export type RouteAction = (
  previousRoute: Route | undefined,
  previousLocation: URL | undefined,
) => unknown;

type RouteListener = NavigationListener<RouteAction> & {
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

  const navigationListeners = new Set<NavigationListener>();
  const navigationEndListeners = new Set<NavigationListener>();
  const listeners = new Map<Route, Set<RouteListener>>();

  let requested = 0;
  let completed = 0;
  let activeChain: Route[] = [];
  let activeRoutes = new Set<Route>();
  let activeLocation: URL | undefined;
  let previousRoute: Route | undefined;
  let previousLocation: URL | undefined;
  let params: RouteParams = null;

  const runNavigation = (listener: NavigationListener) => {
    runInFrame(listener.owner, () => {
      listener.action();
    });
  };

  const dispatchNavigation = (listeners: Set<NavigationListener>) => {
    for (const listener of listeners) {
      runNavigation(listener);
    }
  };

  const runRoute = (listener: RouteListener, pending: unknown[]) => {
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
  const dispatchRoutes = () => {
    const pending: unknown[] = [];
    withScope('', () => {
      for (const route of activeChain) {
        for (const listener of listeners.get(route) ?? []) {
          runRoute(listener, pending);
        }
        if (route.aliasOf) {
          for (const listener of listeners.get(route.aliasOf) ?? []) {
            runRoute(listener, pending);
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

    if (requested - 1 === completed) {
      dispatchNavigation(navigationListeners);
    }

    try {
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
        await dispatchRoutes();

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

      await dispatchRoutes();
    } finally {
      if (id === requested) {
        dispatchNavigation(navigationEndListeners);
      }
    }
  };

  const onNavigation = (
    owner: object,
    eventSet: Set<NavigationListener>,
    action: NavigationAction,
  ) => {
    const listener: NavigationListener = {
      owner,
      action,
    };
    const unregister = onDestroy(owner, () => {
      eventSet.delete(listener);
    });

    if (requested !== completed && eventSet === navigationListeners) {
      runNavigation(listener);
    }

    return () => {
      eventSet.delete(listener);
      unregister();
    };
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
      runRoute(listener, []);
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
    /** Runs `action` when navigation starts. Without `owner`: the current owner. */
    navigation(...args: [NavigationAction] | [object, NavigationAction]) {
      return args.length === 1
        ? onNavigation(
            requireOwner('router.navigation'),
            navigationListeners,
            args[0],
          )
        : onNavigation(args[0], navigationListeners, args[1]);
    },
    /** Runs `action` when navigation ends. Without `owner`: the current owner. */
    navigationEnd(...args: [NavigationAction] | [object, NavigationAction]) {
      return args.length === 1
        ? onNavigation(
            requireOwner('router.navigationEnd'),
            navigationEndListeners,
            args[0],
          )
        : onNavigation(args[0], navigationEndListeners, args[1]);
    },
    /** Stops listening to history and drops every listener. */
    dispose() {
      unlisten();
      listeners.clear();
      navigationListeners.clear();
      navigationEndListeners.clear();
    },
  };
}

export type Router = ReturnType<typeof setupRouter>;
