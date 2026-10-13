import {
  currentFrame,
  DEAD,
  ensureFrame,
  requireCurrent,
  setCurrent,
} from '../core/frame.ts';
import { hydration } from '../core/hydration.ts';
import { report } from '../core/report.ts';
import { noop, removeCleanup, unregister } from '../core/cleanup.ts';
import { browserHistory, type History } from './history.ts';
import {
  addNavigationListener,
  addRouteListener,
  emit,
  type NavigationAction,
  type NavigationListener,
  type RouteAction,
  type RouteListener,
  type RouteOrRoutes,
} from './listeners.ts';
import { compileRoutes, matchRoute, type RouteMatch } from './match.ts';
import type { Route, RouteParams } from './types.ts';

type NavigationEvent = 'start' | 'end';

type Stamped = { [key: symbol]: number | undefined };

export type { RouteAction } from './listeners.ts';

export type RouterOptions = {
  /** URL source. Defaults to browserHistory(); pass memoryHistory() on the server and in tests. */
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
  const history = options.history ?? browserHistory();
  const compiled = compileRoutes(routes);

  const navigationListeners = new Set<NavigationListener>();
  const navigationEndListeners = new Set<NavigationListener>();
  const listeners = new Map<Route, Set<RouteListener>>();
  const STAMP = Symbol('lwn.stamp');
  const fallback = new WeakMap<Route, number>();

  let requested = 0;
  let completed = 0;
  let matchedId = 0;
  let starting = false;
  let activeChain: readonly Route[] = [];
  let activeLocation: URL | undefined;
  let previousRoute: Route | undefined;
  let previousLocation: URL | undefined;
  let params: RouteParams = null;

  const isActive = (route: Route) =>
    ((route as Stamped)[STAMP] ?? fallback.get(route)) === matchedId;

  const runRoute = (listener: RouteListener) => {
    if (listener.ranFor !== matchedId) {
      listener.ranFor = matchedId;
      // Route actions run in their registered frame.
      setCurrent(listener.owner);
      try {
        const result = listener.action(previousRoute, previousLocation);
        if (result instanceof Promise) {
          result.then(undefined, report);
        }
      } catch (error) {
        report(error);
      }
    }
  };

  const runActions = (only?: RouteListener) => {
    const previous = currentFrame();
    if (only) {
      runRoute(only);
    } else {
      const id = requested;
      routes: for (const route of activeChain) {
        const set = listeners.get(route);
        if (set) {
          for (const listener of set) {
            if (requested !== id) {
              break routes;
            }
            runRoute(listener);
          }
        }
      }
    }
    setCurrent(previous);
  };

  const dispatch = (only?: RouteListener) => {
    const h = hydration;
    if (h) {
      h.scope('', () => {
        runActions(only);
      });
    } else {
      runActions(only);
    }
  };

  const navigate = async () => {
    const url = history.location();

    const id = ++requested;

    if (id - 1 === completed) {
      starting = true;
      emit(navigationListeners);
      starting = false;
    }

    try {
      let match = matchRoute(compiled, url.pathname);
      if (match instanceof Promise) {
        match = await match;
        if (id !== requested) {
          return;
        }
      }

      if (match && options.load) {
        const loading = options.load(match, url);
        if (loading instanceof Promise) {
          await loading;
          if (id !== requested) {
            return;
          }
        }
      }

      // Nothing changes without a match, but listeners registered while matching still get the current route.
      if (match) {
        previousRoute = activeChain.at(-1);
        previousLocation = activeLocation;
        activeLocation = url;
        activeChain = match.chain;
        for (const route of match.chain) {
          if (Object.isExtensible(route)) {
            (route as Stamped)[STAMP] = id;
          } else {
            fallback.set(route, id);
          }
        }
        params = match.params && Object.freeze(match.params);
        matchedId = id;
      }
      completed = id;
      dispatch();
    } finally {
      if (id === requested) {
        emit(navigationEndListeners);
      }
    }
  };

  /**
   * Runs `action` whenever one of `target` is in the active chain: the final
   * match or one of its parents. Runs right away if one already is. Ends when
   * `frame` is destroyed.
   */
  function route(target: RouteOrRoutes, action: RouteAction): () => void;
  function route(
    frame: object,
    target: RouteOrRoutes,
    action: RouteAction,
  ): () => void;
  function route(
    frameOrTarget: object,
    targetOrAction: RouteOrRoutes | RouteAction,
    maybeAction?: RouteAction,
  ) {
    const implicit = maybeAction === undefined;
    const owner = implicit
      ? requireCurrent('router.route')
      : ensureFrame(frameOrTarget);
    if (owner.state & DEAD) {
      return noop;
    }
    const target = (implicit ? frameOrTarget : targetOrAction) as RouteOrRoutes;
    const listener = addRouteListener(
      owner,
      listeners,
      target,
      maybeAction ?? (targetOrAction as RouteAction),
    );

    if (requested === completed && listener.target.some(isActive)) {
      dispatch(listener);
    }

    return unregister(listener);
  }

  function on(event: NavigationEvent, action: NavigationAction): () => void;
  function on(
    frame: object,
    event: NavigationEvent,
    action: NavigationAction,
  ): () => void;
  function on(
    frameOrEvent: object | NavigationEvent,
    eventOrAction: NavigationEvent | NavigationAction,
    maybeAction?: NavigationAction,
  ) {
    const implicit = maybeAction === undefined;
    const owner = implicit
      ? requireCurrent('router.on')
      : ensureFrame(frameOrEvent as object);
    if (owner.state & DEAD) {
      return noop;
    }
    const event = implicit ? frameOrEvent : eventOrAction;
    const listener = addNavigationListener(
      owner,
      event === 'start' ? navigationListeners : navigationEndListeners,
      maybeAction ?? (eventOrAction as NavigationAction),
    );

    if (!starting && requested !== completed && event === 'start') {
      emit([listener]);
    }

    return unregister(listener);
  }

  const unlisten = history.listen(() => {
    navigate().catch(report);
  });
  const ready = navigate();

  return {
    /** Resolves after the initial navigation. */
    ready,
    /** Matches `pathname` without navigating. Runs guards; returns a Promise only when a guard does. */
    match(pathname: string) {
      return matchRoute(compiled, pathname);
    },
    /** Pushes `url` and resolves after the route actions run. */
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
    /** Runs `action` while any of the given routes is active. Without `frame`: the current frame. */
    route,
    /** Runs `action` when navigation starts or ends. Without `frame`: the current frame. */
    on,
    /** Stops listening to history and drops every listener. */
    dispose() {
      unlisten();
      for (const set of listeners.values()) {
        for (const listener of set) {
          removeCleanup(listener);
        }
      }
      for (const listener of navigationListeners) {
        removeCleanup(listener);
      }
      for (const listener of navigationEndListeners) {
        removeCleanup(listener);
      }
      listeners.clear();
      navigationListeners.clear();
      navigationEndListeners.clear();
      starting = false;
      activeChain = [];
      activeLocation = undefined;
      previousRoute = undefined;
      previousLocation = undefined;
      params = null;
    },
  };
}

export type Router = ReturnType<typeof setupRouter>;
