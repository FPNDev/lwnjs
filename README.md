# LWN

[![npm version](https://img.shields.io/npm/v/lwn-js.svg)](https://www.npmjs.com/package/lwn-js)

### Please, note - work in progress

A small UI engine built around a **logical tree**. Components are plain functions that create views and attach them to a parent. The tree decides when things live and die: subscriptions, listeners, stores and child components are released when their owner is destroyed.

- **Renderer-agnostic.** A logical node is any object: a DOM node, a WebGL mesh, a plain `{}`. The DOM is just one renderer adapter.
- **O(1) where it matters.** Attach, detach, move, subscribe and unsubscribe are constant time. Destroy is linear in the subtree and makes a single live DOM mutation.
- **No runtime dependencies, tree-shakeable.** ESM, one file per module, `sideEffects: false`. A bundle that imports only `createState` is about 1.6 kB minified. The router, outlets and env are never bundled unless you import them.

```
lwn-js/core     logical tree, lifecycle, state/emitters, stores, isolated envs, listen, renderer
lwn-js/router   routes, history adapters, outlets
lwn-js/html     html`` templates: parsed once per call site, XSS-safe, hydratable
lwn-js/ssr      client side of server rendering: useServer, hydrate, navigation data
lwn-js/server   Node: SSR / SSG / ISR, page cache, build, Node adapter (peer dep: linkedom)
```

---

## Getting started

```sh
npm install lwn-js
```

```ts
// main.ts
import { domRenderer, setRenderer } from 'lwn-js/core';
import { createOutlet, setupRouter, type Route } from 'lwn-js/router';

export const HomeRoute: Route = { path: '/' };
export const UserRoute: Route = { path: /\/users\/(?<id>[^/]+)/ };

setRenderer(domRenderer); // once, before anything is shown
export const router = setupRouter([HomeRoute, UserRoute]);

const app = document.getElementById('app')!;
const page = createOutlet(app); // shows one page at a time inside #app

router.route(app, HomeRoute, () => page.show(() => import('./pages/Home')));
router.route(app, UserRoute, () => page.show(() => import('./pages/User')));
```

```ts
// pages/User.ts
import { attach, createState } from 'lwn-js/core';
import { router, UserRoute } from '../main';

export default function User(parent: object) {
  const node = document.createElement('section');
  attach(parent, node); // join the tree first

  const setName = (newName: string) => {
    node.textContent = `User ${value}`;
  };

  router.route(node, UserRoute, () => {
    setName(router.getParams()?.groups?.id ?? '');
  });

  return node;
}
```

Leaving the user page destroys `node`. That removes it from the DOM and drops the state subscription and the route listener. There is no manual cleanup.

---

## The component pattern

A component is a function that:

1. creates its view (`node`),
2. attaches it to the parent it was given,
3. wires subscriptions, listeners and children, all owned by `node`,
4. returns the view, or a controller object containing it.

```ts
import { attach, component, listen, useStore } from 'lwn-js/core';

export const Counter = component((parent: object) => {
  const node = document.createElement('button');
  attach(parent, node); // the first attach: `node` owns what follows

  const counter = useStore(CounterStore); // found through node's logical ancestors
  counter.value.subscribe((value) => {
    // released when `node` is destroyed
    node.textContent = String(value);
  });
  listen(node, 'click', () => counter.value.set(counter.value.get() + 1));

  return node;
});
```

### Implicit owners

`component()` gives the function a **setup frame**. The first `attach(parent, node)` inside it makes `node` the frame's owner, and owner-taking calls can drop the node:

| Explicit                                             | Owner-less, during setup                 |
| ---------------------------------------------------- | ---------------------------------------- |
| `listen(node, target, type, fn)`                     | `listen(target, type, fn)`               |
| `state.subscribe(node, fn)`                          | `state.subscribe(fn)`                    |
| `router.route(node, Route, action)`                  | `router.route(Route, action)`            |
| `router.routes(node, [A, B], action)`                | `router.routes([A, B], action)`          |
| `useStore(node, Store)` / `attachStore(node, Store)` | `useStore(Store)` / `attachStore(Store)` |
| `onDestroy(node, fn)` / `onAttach(node, hook)`       | `onDestroy(fn)` / `onAttach(hook)`       |

These places open a frame for you, so their code needs no `component()`:

- **pages** shown by outlets,
- **route actions:** the owner is the listener's owner,
- **`onAttach` hooks:** the owner is the attach scope, so whatever they own ends on detach,
- **the app root** under `hydrate` and server rendering.

After an `await`, in an event handler or in a subscription callback there is no frame. Owner-less calls throw there, except `subscribe(fn)`, which is simply unowned outside setup. Pass the owner explicitly in those places, or capture it during setup with `getOwner()`. The explicit forms work everywhere.

Where the view is mounted is up to you (`parent.append(Counter(parent))`). The **logical** parent and the **view** parent are independent. A modal can live logically under the button that opened it while being mounted in `document.body`, and destroying the button still destroys the modal.

### Reattachable components

A component can also be created **without** a parent and attached later, or moved between parents. Anything that depends on where it sits (stores, parent state) then goes in `onAttach`. That hook re-runs on every attach, and everything owned by its `scope` is released on detach:

```ts
export function Badge() {
  const node = document.createElement('span');

  onAttach(node, (scope) => {
    const theme = useStore(node, ThemeStore); // resolved against the current parent
    theme.color.subscribe(scope, (color) => {
      // ends on detach
      node.style.color = color;
    });
  });

  return node;
}

const badge = Badge();
attach(sidebar, badge); // subscribes against sidebar's ThemeStore
attach(header, badge); // old subscription released, new one against header's
```

---

## lwn-js/core

### Logical tree and lifecycle

| Function                | What it does                                                                                                                                                                                    | Cost         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `attach(parent, child)` | Makes `child` a logical child of `parent`, moving it if it had another parent. Runs `onAttach` hooks.                                                                                           | O(1) + hooks |
| `detach(child)`         | Removes `child` from its parent **without** destroying it. Ends its attach scope.                                                                                                               | O(1) + hooks |
| `destroy(node?)`        | Destroys `node` and its whole logical subtree. Views are removed through the renderer, root first (one live mutation), then destroy hooks run, children before parents. `undefined` is ignored. | O(subtree)   |
| `onAttach(node, hook)`  | `hook(scope)` runs on every attach, and immediately if already attached. `scope` is an owner destroyed on the next detach. A returned function also runs on detach.                             | O(1)         |
| `onDestroy(node, hook)` | Runs `hook` once when `node` is destroyed. Returns a function that unregisters it.                                                                                                              | O(1)         |
| `getParent(node)`       | Logical parent, if any.                                                                                                                                                                         | O(1)         |
| `isAttached(node?)`     | Whether `node` has a logical parent.                                                                                                                                                            | O(1)         |
| `component(fn)`         | Wraps a component in a setup frame for implicit owners.                                                                                                                                         | O(1)         |
| `getOwner()`            | The owner of the running setup, if any, e.g. to keep it for after an `await`.                                                                                                                   | O(1)         |

Notes:

- A node is "attached" when it has a **parent**. Roots (an app container) are never attached, even with children.
- A throwing hook does not stop the others. The error is rethrown asynchronously, so it still shows up in the console and error trackers.
- `destroy` on a node that never joined the tree still removes its view.

### Messaging: `createState` and `createEmitter`

Two primitives, chosen by intent:

```ts
import { createEmitter, createState } from 'lwn-js/core';

const loading = createState(false); // has a value
loading.get(); // false
loading.set(true); // notifies

const deleted = createEmitter<number>(); // fire-and-forget
deleted.emit(42);
const submitted = createEmitter(); // Emitter<void>
submitted.emit();
```

Both share one `subscribe`, with or without an owner:

```ts
loading.subscribe(node, (value) => { … });     // ends when `node` is destroyed
const off = deleted.subscribe((id) => { … });  // unowned: call off() yourself
```

Both forms return an unsubscribe function (O(1)). Delivery rules:

- A notification reaches the listeners subscribed **when it started** and still subscribed when their turn comes. Unsubscribing during a notification never skips a neighbour, and listeners added during a notification wait for the next one.
- A throwing listener does not stop the others (the error is rethrown asynchronously).
- `set` always notifies, even with the same value. Mutate objects in place and call `notify()` to announce the change; no copies needed.
- Owners must be objects (not functions). That is how `subscribe(owner, fn)` is told apart from `subscribe(fn)`.

For a stream that ends, return a promise next to an emitter:

```ts
function download(url: string) {
  const progress = createEmitter<number>();
  const done = fetchWithProgress(url, (p) => progress.emit(p));
  return { progress, done };
}
```

### Stores

Values provided by a node to its logical descendants, like context.

```ts
import { attachStore, createStore, useStore } from 'lwn-js/core';

export const ChatStore = createStore(() => ({
  loading: createState(false),
  submit: createEmitter<string>(),
}));

// provider
const chat = attachStore(pageNode, ChatStore); // fresh value per provider

// any logical descendant
const chat = useStore(messageNode, ChatStore); // nearest provider up the tree
```

- `useStore` walks up logical parents: O(depth), once per component setup. It throws if nothing provides the store, so attach before resolving (or resolve in `onAttach`).
- Store values can be anything, `undefined` included.

### Isolated envs

One env is **current** at a time, optionally nested in another. Use it to route keyboard shortcuts and other global input to the right place: an input inside a modal handles Enter, while Escape still reaches the modal.

```ts
import { env } from 'lwn-js/core';

const modalEnv = Symbol('modal');
const inputEnv = Symbol('input');

env.isolate(modalEnv); // modal opened
env.isolate(inputEnv, modalEnv); // input focused inside the modal

env.is(modalEnv); // true:  modal is active (it contains the current env)
env.isCurrent(modalEnv); // false: the input is innermost
env.isCurrent(inputEnv); // true

env.release(inputEnv); // input blurred → modal is current again
env.release(modalEnv); // modal closed → releases anything nested in it too
```

| Call                       | Meaning                                                                                                                                            | Cost        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `env.isolate(id, within?)` | `id` becomes current. If `within` is active, `id` nests inside it; otherwise all other envs are released (siblings never stay active by accident). | O(released) |
| `env.release(id)`          | Releases `id` and everything nested in it.                                                                                                         | O(released) |
| `env.is(id)`               | `id` is current or contains the current env.                                                                                                       | O(1)        |
| `env.isCurrent(id)`        | `id` is the innermost env.                                                                                                                         | O(1)        |
| `env.current`              | The innermost env, or `undefined`.                                                                                                                 | O(1)        |

Precedence is a choice of check. Keys the inner env may consume check `isCurrent`; keys that should work anywhere inside check `is`:

```ts
listen(modal, document, 'keydown', (event) => {
  if (event.key === 'Escape' && env.is(modalEnv)) {
    closeModal(); // works while typing in the input too
  }
  if (event.key === 'Enter' && env.isCurrent(modalEnv)) {
    confirm(); // the input gets Enter while it is focused
  }
});
```

Release the env with its component: `onDestroy(modal, () => env.release(modalEnv))`.

**Recipe: isolate on focus (DOM).** Use `focusin`/`focusout` (they bubble) and ignore focus moves that stay inside the element:

```ts
function isolateOnFocus(
  owner: object,
  element: HTMLElement,
  id: symbol,
  within?: symbol,
) {
  listen(owner, element, 'focusin', () => env.isolate(id, within));
  listen(owner, element, 'focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) {
      env.release(id);
    }
  });
  onDestroy(owner, () => env.release(id));
}
```

### `listen`

`listen(owner, target, type, listener, options?)` is `addEventListener` that is removed when `owner` is destroyed. It is typed per target (`HTMLElement`, `Window`, `Document`, any `EventTarget`) and returns a function that removes it early.

### Renderers

The engine needs three view operations, supplied once with `setRenderer`:

```ts
type Renderer<V extends object> = {
  append(parent: V, view: V): void; // outlets without a placeholder
  insertBefore(anchor: V, view: V): void; // outlets with a placeholder, in-place swaps
  remove(view: V): void; // destroy; must ignore non-view objects
};
```

`domRenderer` is the DOM implementation. It uses no globals, so it also works with server-side DOM libraries. Any other view system can plug in. A sketch for a three.js scene graph:

```ts
setRenderer<Object3D>({
  append: (parent, view) => parent.add(view),
  insertBefore: (anchor, view) => anchor.parent?.add(view),
  remove: (view) => view.parent?.remove(view),
});
```

---

## lwn-js/router

### Routes

```ts
type Route = {
  path: string | RegExp;
  guard?(params): unknown | Promise<unknown>; // must pass for this route to be the final match
  guardChildren?(params): unknown | Promise<unknown>; // must pass before children are searched
  children?: readonly Route[];
};
```

- Routes match **in order**, first match wins (put catch-alls like `/.*/` last).
- String paths join their parent with `/` (`'/settings'` + `'profile'` → `/settings/profile`). RegExp paths are concatenated as written, and named groups become params.
- A trailing slash matches (`/chat/` ≡ `/chat`).
- **Index routes:** a child with `path: ''` matches its parent's exact path, so `/account` can render an overview inside the account layout: `{ path: '/account', children: [{ path: '' }, { path: 'orders' }] }`.
- The tree is compiled once in `setupRouter`. Route objects are never mutated, so one route can appear under several parents.

### `setupRouter(routes, options?)`

Returns the router and runs the initial navigation. Options:

- `history`: URL source. Default `browserHistory()`, or `memoryHistory()` where there is no `window`.
- `load(match, url)`: runs after a match and before route actions; navigation waits for it. `lwn-js/ssr` uses it to fetch page data.

| Member                          | What it does                                                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`                         | Promise of the initial navigation.                                                                                                                                                                                                                                                  |
| `match(pathname)`               | Matches without navigating (guards run). Resolves to `{ chain, params }` or `undefined`.                                                                                                                                                                                            |
| `route(owner, route, action)`   | Runs `action(previousRoute, previousLocation)` when `route` is in the **active chain**, i.e. the final match **or one of its parents**, so layouts listen to their parent route. Runs right away if it already is. Ends when `owner` is destroyed. Returns an unsubscribe function. |
| `routes(owner, routes, action)` | Same, for several routes. Fires once per navigation even if several of them are active.                                                                                                                                                                                             |
| `go(url)`                       | Pushes `url` and navigates. Resolves after all actions **and the promises they return** settle. Unmatched paths change nothing and do not throw.                                                                                                                                    |
| `getPath()`                     | Current pathname.                                                                                                                                                                                                                                                                   |
| `getParams()`                   | `RegExpMatchArray` of the final match (`params.groups.id`), or `null` for string routes.                                                                                                                                                                                            |
| `dispose()`                     | Stops listening to history and drops all listeners.                                                                                                                                                                                                                                 |

Listener dispatch is O(depth of the matched chain) via a per-route index, independent of how many listeners exist elsewhere. Concurrent navigations resolve latest-wins.

```ts
const Profile: Route = { path: 'profile' };
const Settings: Route = {
  path: '/settings',
  guardChildren: () => auth.loggedIn,
  children: [Profile],
};

router.route(layout, Settings, () => showSettingsLayout()); // fires for /settings/profile too
router.route(layout, Profile, () => content.show(ProfilePage));
```

### History adapters

- `browserHistory()` (default): `window.location`, `pushState`, `popstate`.
- `memoryHistory(url = '/')`: in-memory, for tests and server rendering.

```ts
const router = setupRouter(routes, {
  history: memoryHistory('/settings/profile'),
});
```

### `aliasRoute(route, path)`

Serves a whole route tree under another path. Guards are kept, and listeners registered on the **original** routes (children included) fire for the alias.

```ts
const Legacy = aliasRoute(Settings, '/preferences'); // /preferences/profile → Profile listeners
```

### Outlets

An outlet shows one view at a time in a slot:

```ts
const content = createOutlet(owner, placeholder?);
await content.show(ProfilePage);                 // factory: (parent) => view
await content.show(() => import('./Profile'));   // lazy: module default or factory
content.clear();
```

- Views are attached to `owner` and receive it as `parent`. With a `placeholder` view (e.g. an empty comment) they are inserted **before** it and the placeholder stays mounted. Without one they are appended to `owner`.
- Showing the same factory again (directly, or as the same module default) keeps the current view; route changes are then handled by the page's own route listeners.
- **Latest wins:** if a lazy view resolves after a newer `show`/`clear`, it is dropped and its `show` resolves to `undefined`.
- Switching views inserts the new one before the old, then destroys the old, so the position is kept and there is no empty frame.
- Several outlets can share an owner.
- Destroying the owner destroys the shown view and cancels pending loads.

---

## lwn-js/html

```ts
import { element, html, mhtml, text } from 'lwn-js/html';

const title = html`<h1 class=${classes.title}>${user.name}</h1>`; // one root
const items = mhtml`<li>a</li><li>b</li>`; // several roots
const card = html`<article title="${hint}">${title}${items}</article>`;
```

- **Values are never parsed as HTML.** Strings and numbers become text nodes, or attribute text inside tags. Nodes and arrays of nodes are inserted as they are. `null`/`undefined` render nothing.
- **Parsed once per call site.** The markup is cached by the template-literal identity. Each call clones it and fills the slots (O(slots)) instead of re-parsing.
- **Context-correct.** It parses through `<template>`, so ``html`<tr>…</tr>` `` works.
- **Hydratable.** Under `hydrate`, `html`, `mhtml`, `element` and `text` adopt the server-rendered nodes instead of creating new ones (see below). Views made with raw `document.createElement` are not hydrated.

Limitations: one value per attribute position (no interpolated attribute _names_), and a literal `>` inside a static attribute value confuses slot detection.

---

## Server rendering: lwn-js/ssr + lwn-js/server

The same app code renders on the server (Node, DOM from `linkedom`) and hydrates in the browser.
`lwn-js/ssr` is client-safe. `lwn-js/server` is Node-only, so keep it out of the client bundle.

### The app

```ts
// app.ts (shared)
import { setRenderer, domRenderer } from 'lwn-js/core';
import { createOutlet, setupRouter, type Route } from 'lwn-js/router';
import { loadServerData, serverToken } from 'lwn-js/ssr';

setRenderer(domRenderer);
export const ProductRoute: Route = { path: /\/products\/(?<handle>[\w-]+)/ };
export const routes = [ProductRoute];
export const router = setupRouter(routes, { load: loadServerData(routes) });
export const ProductData = serverToken<Product>('product');

export function App(container: Element) {
  const page = createOutlet(container);
  router.route(container, ProductRoute, () =>
    page.show(() => import('./pages/Product')),
  );
}

// pages/Product.ts
export default function Product(parent: object) {
  const product = useServer(ProductData); // O(1); throws if the page has no such data
  const node = html`<main><h1>${product.title}</h1></main>`;
  attach(parent, node);
  return node;
}

// entry-client.ts
await hydrate(document.querySelector('#app')!, App, router);
```

### The server

```ts
// entry-server.ts (Node only)
import { defineServerApp, type ServerRoute } from 'lwn-js/server';

const serverRoutes: ServerRoute[] = [
  {
    route: ProductRoute,
    mode: 'isr', // 'ssr' (default) | 'ssg' | 'isr'
    revalidate: 60, // seconds until stale (isr)
    paths: async () =>
      (await topProducts()).map((p) => `/products/${p.handle}`), // prerendered by build()
    load: async ({ params, request }, set) => {
      set(ProductData, await getProduct(params!.groups!.handle));
    },
  },
  { route: NotFoundRoute, mode: 'ssg', status: 404 },
];

// the whole server side of an app
export default defineServerApp({ router, routes, serverRoutes, app: App });
```

```sh
lwn dev     # Vite middleware + SSR from source, reloads on change
lwn build   # client bundle + manifest, server bundle, prerender of ssg/isr paths
lwn start   # production: static assets, pages, __data.json, ISR from dist/client
```

`PORT` sets the port. `REVALIDATE_SECRET` enables `POST /api/revalidate?path=…&secret=…`. With `vite` installed (optional peer), the CLI handles the Vite side.

For a custom server, use the pieces directly: `createServer({ template, router, routes, serverRoutes, app, manifest, cache: fsCache('dist/client') })` and `toNodeHandler(server, { staticDir, revalidateSecret })` for `http`, Connect or Express.

| API                                  | What it does                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.handle(request)`             | Handles `GET`/`HEAD` for pages (`/path`) and page data (`/path/__data.json`). Returns a `Response`, or `undefined` for unmatched paths (fall through to static files). Header `x-engine-cache`: `BYPASS`, `HIT`, `STALE` or `MISS`. |
| `server.build({ outDir })`           | Prerenders every `paths()` entry of `ssg`/`isr` routes as `<path>/index.html` + `<path>/__data.json`. Read the template first: the root page overwrites `index.html`.                                                               |
| `server.revalidate(path)`            | Re-renders a cached page now (on-demand ISR). The old version is served until the new one is ready.                                                                                                                                 |
| `memoryCache(max?)` / `fsCache(dir)` | Page caches: LRU in memory, or files in static-hosting layout (what `build` writes).                                                                                                                                                |
| `toNodeHandler(server, options?)`    | `(req, res, next?)` middleware for `http`, Connect, Express and Vite. Options: `staticDir` (assets, `/assets/*` cached forever), `revalidateSecret` (on-demand ISR endpoint).                                                       |
| `defineServerApp(config)`            | The default export of the server entry, used by the CLI. It creates the server inside the app's bundle, so the server and the components share one engine instance.                                                                 |

Modes:

- **ssr**: rendered per request. Loaders get the `request` (cookies, headers).
- **ssg**: rendered once (at build, or on first request) and never expires.
- **isr**: like `ssg`, but once older than `revalidate` seconds the old page is served and a fresh one renders in the background. Concurrent requests share one render.

### How it works

1. **Loaders first.** The server matches the URL, then runs the `load` of every server route in the matched chain (layout + page) in parallel, outside the render lock.
2. **Render.** Renders run one at a time, because they share module state (the global `document`, the app's router). The server navigates the app's router to the URL, calls `App(container)`, and waits until every outlet load has settled (`timeout`, default 10 s).
3. **Payload.** Next to the HTML it embeds `<script id="__engine" type="application/json">`, with `<` escaped. It holds the page data and, for every view created through `lwn-js/html`, its `childNodes` path. Views are keyed by render scope: the root, then one scope per outlet. That keeps keys stable even when lazy pages resolve in a different order on the client.
4. **Hydrate.** `hydrate` resolves all paths to nodes up front. App code then runs normally, but each `html`/`element`/`text` call returns the server node it corresponds to. Event handlers and subscriptions attach to the existing DOM. When the outlets settle, unclaimed nodes are released and the payload script is removed.
5. **Navigation.** Later navigations go through the router `load` hook. For routes with server data it fetches `/path/__data.json` (served by `handle` or by the SSG files) before route actions run.

### Rules for hydratable code

- Render **synchronously** from `useServer` data. Async work (fetches, timers) runs on the client after hydration; skip it on the server with `isServer`.
- **Compose with templates.** ``html`<div>${a}${b}</div>` `` is a no-op while hydrating. An imperative `parent.append(a)` into a parent that still holds later server nodes moves `a` to the end until those are claimed too, which can flash briefly while a lazy page loads.
- **Same order on both sides.** Don't branch on `window`, `Date.now()`, `Math.random()` or `isConnected` in the code that creates views.
- **Valid nesting.** Markup the HTML parser would restructure (a `<div>` inside a `<p>`, `<tr>` outside a table) breaks the paths.
- **Ship lean data.** Everything a loader `set`s is serialized into the page and stays available to `useServer` until the next navigation. Map API responses to what the page shows.

---

## Complexity summary

| Operation                               | Cost                                 |
| --------------------------------------- | ------------------------------------ |
| attach / detach / move                  | O(1) + hooks                         |
| destroy                                 | O(subtree), 1 live view mutation     |
| subscribe / unsubscribe / owner release | O(1)                                 |
| emit / set                              | O(listeners), no allocations         |
| useStore                                | O(depth), once per setup             |
| env `is` / `isCurrent`                  | O(1)                                 |
| `html` (cached template)                | O(slots) clone + fill                |
| hydration claim / `useServer`           | O(1) after one O(paths) resolve pass |
| route dispatch                          | O(active chain depth)                |
| route match                             | O(routes), precompiled               |

---

## Development

```sh
npm test          # vitest: happy-dom for client tests, node for server tests
npm run lint      # oxlint
npm run build     # tsc → dist/ (ESM + .d.ts)
npm run dev       # tsc --watch, for apps linked via file:
npm publish       # prepublishOnly: clean, typecheck, lint, test, build; only dist/ is packed
```
