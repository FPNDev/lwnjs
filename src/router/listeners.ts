import {
  currentFrame,
  setCurrent,
  type Cleanup,
  type Frame,
} from '../core/frame.ts';
import { report } from '../core/report.ts';
import { addCleanup } from '../core/cleanup.ts';
import type { Route } from './types.ts';

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
