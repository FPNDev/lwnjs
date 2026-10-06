# 7. Routing

`lwn-js/router` matches URLs against a tree of route objects and runs actions for the routes that are active. It doesn't render anything itself: route actions decide what to show, usually through outlets ([Outlets and layouts](08-outlets-and-layouts.md)).

## Route objects

```ts
import { type Route } from 'lwn-js/router';

export const HomeRoute: Route = { path: '/' };
export const SearchRoute: Route = { path: '/search' };
export const ProductRoute: Route = { path: /\/products\/(?<handle>[\w-]+)/u };
export const OverviewRoute: Route = { path: '' }; // index route
export const OrdersRoute: Route = { path: 'orders' };
export const AccountRoute: Route = {
  path: '/account',
  children: [OverviewRoute, OrdersRoute],
};
export const NotFoundRoute: Route = { path: /.*/u }; // catch-all, last

export const routes = [
  HomeRoute,
  SearchRoute,
  ProductRoute,
  AccountRoute,
  NotFoundRoute,
];
```

A route is a plain object, and its **identity** is what you listen to. Keep route objects in one module and import them wherever you need them.

| Field                   | Meaning                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `path`                  | A string or a RegExp, relative to the parent route                               |
| `children`              | Nested routes, matched after the parent's prefix                                 |
| `guard(params)`         | Must return truthy (or a promise of truthy) for this route to be the final match |
| `guardChildren(params)` | Must pass before this route's children are searched                              |
| `aliasOf`               | Set by `aliasRoute`; don't set it yourself                                       |

## How matching works

The tree is compiled once in `setupRouter`; route objects are never mutated, so one route object may appear under several parents.

**Joining paths:**

- string + string: joined with exactly one `/` (`'/account'` + `'orders'` → `/account/orders`).
- string + `''`: the parent's path itself (an index route).
- anything with a RegExp: the sources are concatenated. A string child gets a `/` separator, and is escaped.

**Matching a pathname** walks the routes in order:

1. **A full match** (the whole pathname, optionally with a trailing slash):
   - If the route has children, an index child (`''`) is tried first, so `/account` → `[AccountRoute, OverviewRoute]`.
   - Otherwise the route's `guard` must pass.
2. **A prefix match:** for string paths, only at a `/` boundary (`/chat` doesn't prefix-match `/chatroom`). It descends into children if `guardChildren` passes.
3. **The first full match wins.** Put catch-alls last.

The result is the **active chain**: the matched route and its parents, e.g. `/account/orders` → `[AccountRoute, OrdersRoute]`.

**Params** come from RegExp named groups of the final match:

```ts
router.getParams()?.groups?.handle; // '/products/slides' → 'slides'
```

String routes have no params (`getParams()` is `null`).

## Creating the router

```ts
import { setupRouter } from 'lwn-js/router';

export const router = setupRouter(routes, {
  history: browserHistory(), // default; memoryHistory() where there is no window
  load: async (match, url) => {}, // optional: runs after a match, before actions
});
```

`setupRouter` immediately runs the initial navigation; `router.ready` resolves when it's done.

## Listening to routes

```ts
router.route(ProductRoute, () => {
  showProduct(router.getParams()?.groups?.handle);
});

router.routes([HomeRoute, SearchRoute], () => highlightNav());
```

- **When it runs:** an action runs when its route is in the active chain after a navigation, and **right away** when you register it while the route is already active. Registration order doesn't matter.
- **Once per navigation:** even if a listener covers several active routes, or both a route and its alias.
- **Parents fire for children:** a listener on `AccountRoute` runs for `/account/orders` too, which is how layouts work.
- **Owner:** the listener ends when its owner is destroyed. Without an explicit owner it's the current setup owner (see [Components](03-components.md)). Actions run in a frame owned by the listener's owner, so owner-less calls inside them belong to that owner.
- **Signature:** the action receives `(previousRoute, previousLocation)`.
- **Async actions:** if an action returns a promise, `router.go()` waits for it.

## Navigation

```ts
await router.go('/products/slides'); // push + navigate; resolves after actions settle
router.getPath(); // current pathname
router.getParams(); // RegExpMatchArray of the final match, or null
await router.match('/account'); // match without navigating (guards run)
router.dispose(); // stop listening to history, drop all listeners
```

A navigation, step by step:

1. Read the URL from history. If pathname and search equal the active ones, stop.
2. Match (guards may be async). If a newer navigation started meanwhile, stop: **latest wins**.
3. Run the `load` hook, if any, and wait for it. Check for a newer navigation again.
4. No match? Nothing changes. Listeners registered in the meantime still get the current route.
5. Activate the new chain, freeze the params, and run the listeners of every route in the chain, parents first, in one setup scope.
6. `go()` resolves once the actions and the promises they returned have settled.

Back/forward (`popstate`) runs the same steps.

## Guards

```ts
const AdminRoute: Route = {
  path: '/admin',
  guardChildren: () => session.isAdmin, // protects the whole subtree
  children: [{ path: '' }, { path: 'users' }],
};

const DraftRoute: Route = {
  path: /\/drafts\/(?<id>\d+)/u,
  guard: async (params) => api.canEdit(params?.groups?.id),
};
```

A route whose guard fails is skipped, and matching continues with the next routes, so a catch-all can show "not found" or "forbidden".

## Aliases

```ts
export const LegacyAccount = aliasRoute(AccountRoute, '/profile');
```

`aliasRoute` clones a route tree under another path. Guards are kept, and listeners registered on the **original** routes, children included, fire for the aliased paths too.

## History adapters

| Adapter               | Use                                                              |
| --------------------- | ---------------------------------------------------------------- |
| `browserHistory()`    | `window.location`, `pushState`, `popstate` (default in browsers) |
| `memoryHistory(url?)` | In-memory: the default on the server, and handy in tests         |

A custom adapter implements `{ location(): URL; push(url): void; listen(onChange): () => void }`, e.g. for hash routing.

## Links

Anchors stay real links (middle click and Ctrl-click still open tabs). A tiny helper makes a plain click navigate in-app:

```ts
export function routerLink(anchor: HTMLAnchorElement) {
  listen(anchor, 'click', (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void router.go(anchor.getAttribute('href')!);
    }
  });
}
```

For many links, one delegated listener on a container works too.

## Active state in navigation

```ts
let active: HTMLElement | undefined;
router.routes([HomeRoute, ListRoute], () => {
  active?.classList.remove('active');
  active = links.get(currentId());
  active?.classList.add('active');
});
```

## Server side

The same router works on the server: with no `window`, it defaults to `memoryHistory()`. The server navigates it per request (renders run one at a time). See [Server rendering](11-server-rendering.md).
