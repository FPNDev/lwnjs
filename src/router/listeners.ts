import {
  currentFrame,
  setCurrent,
  type Cleanup,
  type Frame,
} from '../core/frame.ts';
import { hydration } from '../core/hydration.ts';
import { report } from '../core/report.ts';
import { addCleanup, noop } from '../core/cleanup.ts';
import type { Route } from './types.ts';

/** Collects async work of route actions and lazy views; undefined when nothing awaits it. */
export let work: Promise<unknown>[] | undefined;

/** Runs `run` while async work is collected into `into`. */
export function collectWork<T>(
  into: Promise<unknown>[] | undefined,
  run: () => T,
): T {
  const previous = work;
  work = into;
  try {
    return run();
  } finally {
    work = previous;
  }
}

/** Adds `promise` to the collected work, or reports its failure when nothing collects. */
export function trackWork(promise: Promise<unknown>) {
  if (work) {
    promise.then(undefined, noop);
    work.push(promise);
  } else {
    promise.then(undefined, report);
  }
}

/** Resolves once all collected work, including work added meanwhile, settles; rejects with the first failure. */
export async function settleWork(pending: Promise<unknown>[]) {
  while (pending.length > 0) {
    await Promise.all(pending.splice(0));
  }
}

export type RouteOrRoutes = Route | readonly Route[];
export type NavigationAction = () => void;

export type RouteAction = (
  previousRoute: Route | undefined,
  previousLocation: URL | undefined,
) => unknown;

/** A route action registration; also a cleanup entry of its frame. */
export type RouteListener = Cleanup & {
  action: RouteAction;
  /** Navigation id this listener last ran for, so it runs once per navigation. */
  ranFor: number;
  /** Hydration key the action's views are created under. */
  key: string;
  target: readonly Route[];
  map: Map<Route, Set<RouteListener>>;
};

/** A navigation start or end registration; also a cleanup entry of its frame. */
export type NavigationListener = Cleanup & {
  action: NavigationAction;
  set: Set<NavigationListener>;
};

function disposeRoute(this: RouteListener) {
  const { target, map } = this;
  for (const route of target) {
    const set = map.get(route);
    if (set?.delete(this) && set.size === 0) {
      map.delete(route);
    }
  }
}

function disposeNavigation(this: NavigationListener) {
  this.set.delete(this);
}

function addTo(
  map: Map<Route, Set<RouteListener>>,
  route: Route,
  listener: RouteListener,
) {
  let set = map.get(route);
  if (!set) {
    set = new Set();
    map.set(route, set);
  }
  set.add(listener);
}

/** Adds a listener for every route of `target`, owned by `frame`. */
export function addRouteListener(
  frame: Frame,
  map: Map<Route, Set<RouteListener>>,
  target: RouteOrRoutes,
  action: RouteAction,
  key: string,
) {
  const routes = (
    Array.isArray(target) ? target : [target]
  ) as readonly Route[];
  const listener: RouteListener = {
    dispose: disposeRoute,
    owner: undefined,
    prevCleanup: undefined,
    nextCleanup: undefined,
    action,
    ranFor: -1,
    key,
    target: routes,
    map,
  };
  for (const route of routes) {
    addTo(map, route, listener);
  }
  addCleanup(frame, listener);

  return listener;
}

/** Adds a navigation listener to `set`, owned by `frame`. */
export function addNavigationListener(
  frame: Frame,
  set: Set<NavigationListener>,
  action: NavigationAction,
) {
  const listener: NavigationListener = {
    dispose: disposeNavigation,
    owner: undefined,
    prevCleanup: undefined,
    nextCleanup: undefined,
    action,
    set,
  };
  set.add(listener);
  addCleanup(frame, listener);

  return listener;
}

/** Runs a route action under its hydration key; its async work and failures are collected, or reported when nothing collects. */
export function runRouteAction(
  listener: RouteListener,
  previousRoute: Route | undefined,
  previousLocation: URL | undefined,
) {
  try {
    const h = hydration;
    const result = h
      ? h.scope(listener.key, () =>
          listener.action(previousRoute, previousLocation),
        )
      : listener.action(previousRoute, previousLocation);
    if (result instanceof Promise) {
      trackWork(result);
    }
  } catch (error) {
    if (work) {
      trackWork(Promise.reject(error));
    } else {
      report(error);
    }
  }
}

/** Runs navigation actions in their frames; a throw is reported and the rest still run. */
export function emit(listeners: Iterable<NavigationListener>) {
  const previous = currentFrame();
  for (const listener of listeners) {
    setCurrent(listener.owner);

    try {
      listener.action();
    } catch (error) {
      report(error);
    }
  }

  setCurrent(previous);
}
