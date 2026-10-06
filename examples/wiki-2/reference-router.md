# Router reference

Import router APIs from `lwn-js/router`.

```ts
import {
  aliasRoute,
  browserHistory,
  createOutlet,
  memoryHistory,
  setupRouter,
  type Route,
  type RouteParams,
} from 'lwn-js/router';
```

## Route objects

A route is a stable object that describes a path, optional guards, and optional children.

```ts
type Route = {
  path: string | RegExp;
  guard?: (params: RouteParams) => unknown;
  guardChildren?: (params: RouteParams) => unknown;
  children?: readonly Route[];
  aliasOf?: Route;
};
```

Define route objects once and share those objects between the router, server routes, and route listeners. Route identity matters: the router registers actions against the route objects themselves.

String paths join their parent path with a slash. An empty child path is an index route, which matches the parent's exact path.

```ts
const AccountRoute: Route = {
  path: '/account',
  children: [{ path: '' }, { path: 'orders' }],
};
```

This produces /account and /account/orders. A child path may include a leading slash. The router avoids adding a duplicate slash at the join.

A regular expression is useful when a path has parameters. Named captures are available in `getParams()` through the match array's `groups` property.

```ts
const ProductRoute: Route = {
  path: /^\/products\/(?<handle>[\w-]+)$/u,
};
```

For this route, `router.getParams()?.groups?.handle` contains the matched handle.

## Matching order and guards

Routes are checked in array order. The first full match that passes its guards wins. If a route partially matches and has children, the router searches those children before treating the parent as the final route.

`guardChildren(params)` decides whether matching may continue into the route's children. `guard(params)` decides whether the route itself may be the final match. A guard may return a boolean or a promise. A false-like result rejects that candidate.

```ts
const AdminRoute: Route = {
  path: '/admin',
  guardChildren: () => session.isAuthenticated(),
  children: [
    {
      path: 'reports',
      guard: () => session.user?.role === 'admin',
    },
  ],
};
```

Guards run during both navigation and `router.match(pathname)`. Keep them focused on deciding whether a route can match. Use the router's `load` hook for work that must finish before route actions run.

## Create and navigate

`setupRouter(routes, options?)` compiles routes and starts the initial navigation.

```ts
const router = setupRouter(routes, {
  history: browserHistory(),
});
await router.ready;
```

Without an explicit history adapter, `setupRouter` selects browser history when `window` exists and memory history otherwise. This lets a shared app module create its router on the client and during server rendering.

| Method or property          | Behavior                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ready`                     | Promise for the initial navigation                                                                                      |
| `navigation(listener)`      | Subscribes to start notifications before matching
| `navigationEnd(listener)`   | Subscribes to completion notifications for the latest navigation.                                                         |
| `go(url)`                   | Pushes a URL and resolves after matching, the optional load hook, route actions, and promises returned by those actions |
| `getPath()`                 | Current pathname                                                                                                        |
| `getParams()`               | Parameters from the current match, or `null`                                                                            |
| `match(pathname)`           | Matches without navigating, while still running guards                                                                  |
| `route(route, action)`      | Registers an action for one route                                                                                       |
| `routes(routeList, action)` | Registers an action for any route in the list                                                                           |
| `dispose()`                 | Stops listening to history and removes route listeners                                                                  |

The optional `load(match, url)` hook runs after a route matches and before route actions. It may be asynchronous. Newer navigations supersede older pending navigations, so an older match or loader does not replace the latest location.

`navigation(listener)` fires before matching when no match/load is pending. A newer navigation that supersedes a pending match or load does not fire another start. 
`navigationEnd()` fires for the latest request after its route actions and any promises they return settle. These notifications do not lock navigation: after a match is committed, the router can start another navigation while async route actions from the previous one are still settling. 

```ts
router.navigation(() => loadingIndicator.show());
router.navigationEnd(() => loadingIndicator.hide());
```

`go()` compares pathname and search to avoid repeating the same navigation. It pushes the URL through the chosen history adapter. For browser back and forward, the adapter notifies the router and starts navigation.

## Route actions and ownership

A route action runs while its route is in the active chain. Parent routes remain active when a child route is selected, which is how layouts keep their actions registered.

```ts
const appOwner = {};
router.route(appOwner, AccountRoute, () => {
  accountOutlet.show(AccountLayout);
});
```

The explicit owner form is useful outside a component setup frame. Inside `component(...)` or another owner frame, the owner can be omitted:

```ts
router.route(AccountRoute, () => {
  return accountOutlet.show(AccountLayout);
});
```

The action also runs immediately if its route is already active when the listener is registered. Its arguments are the previously active final route and previous URL. Return a promise when navigation should wait for asynchronous work, such as an outlet swap.

Each registration returns an unregister function. Call it to remove that action before its owner is destroyed.

Signatures:

```ts
router.route(route, action);
router.route(owner, route, action);
router.routes(routeList, action);
router.routes(owner, routeList, action);
```

Destroying the owner unregisters its route actions. `dispose()` removes all actions and the history listener. Call it when the router itself is no longer needed.

## History adapters

A history adapter supplies the current URL, navigation, and a change listener.

```ts
type History = {
  location(): URL;
  push(url: string): void;
  listen(onChange: () => void): () => void;
};
```

- `browserHistory()` reads `window.location`, uses `pushState`, and listens for `popstate`.
- `memoryHistory(initialUrl?)` stores the URL in memory. It is useful for tests and server rendering. The default URL is `/`.

Pass your own adapter with the same three methods when an application uses another navigation source. The router calls `listen` once and calls the returned unsubscribe function from `dispose()`.

## Aliases

`aliasRoute(route, path)` copies a route and its children under another root path. The copied routes retain a link to their originals, so listeners registered for the original routes also run for alias matches. Guards are retained.

```ts
const LegacyAccountRoute = aliasRoute(AccountRoute, '/profile');
```

An alias is useful for an alternate URL that should display the same pages and use the same route actions. Server route configuration may refer to the original route object.

## Outlets

An outlet shows one view at a position and destroys the previous view after the replacement is mounted. Create the engine renderer before the first outlet uses it.

```ts
const outlet = createOutlet(owner, placeholder);
const shown = await outlet.show(Page);
await outlet.show(() => import('./Page'));
outlet.clear();
```

- `owner` is the logical parent of every view shown by the outlet.
- `placeholder` is optional. When present, views are inserted before it and it stays in place. Without one, views are appended under `owner`.
- `show(factory)` builds a view. A page factory receives `owner` and returns its root view.
- `show(loader)` accepts a dynamic import that resolves to a default page factory, or directly to a factory.
- Showing the same factory keeps the current view. A lazy loader that resolves to the currently displayed factory also keeps it.
- If another `show()` or `clear()` supersedes an in-flight loader, the earlier promise resolves to `undefined`.
- `clear()` destroys the current view.

Outlet factories run in a setup frame, so owner-less listeners and subscriptions created by the page are released with it. Each shown view is attached to `owner`. The renderer mounts and removes its view. During server rendering and hydration, outlet work is tracked so the page does not finish before lazy views settle.

If the outlet has no renderer, it throws `Outlet: no renderer set. Call setRenderer() at startup.` See [Core reference](reference-core.md) for renderer setup.
