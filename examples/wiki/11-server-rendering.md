# 11. Server rendering

The same components render to HTML on the server and **hydrate** in the browser: the client adopts the server's DOM instead of rebuilding it. Pages can be rendered per request (SSR), once at build time (SSG), or cached and refreshed in the background (ISR).

Two entry points are involved:
- `engine-ts/ssr`: client-safe, imported by app code (`serverToken`, `useServer`, `hydrate`, `loadServerData`, `isServer`).
- `engine-ts/server`: Node only, imported by the server entry (`defineServerApp`, `createServer`, caches, `toNodeHandler`).

Server rendering produces HTML; it uses `linkedom` as the server DOM (an optional peer dependency).

## The pieces of an app

```
src/
  app.ts              App, routes, router (shared)
  data.ts             server data tokens (shared)
  server-routes.ts    modes, loaders, paths (Node only)
  entry-client.ts     hydrate(...)
  entry-server.ts     export default defineServerApp(...)
index.html            <div id="app"></div> + the client entry script
```

```ts
// app.ts
setRenderer(domRenderer);
export const routes = [HomeRoute, ProductRoute, AccountRoute, NotFoundRoute];
export const router = setupRouter(routes, { load: loadServerData(routes) });
export const App = component((container: Element) => { … });

// entry-client.ts
await hydrate(document.querySelector('#app')!, App, router);

// entry-server.ts
export default defineServerApp({ router, routes, serverRoutes, app: App });
```

- **`setupRouter` on both sides:** with no `window` it uses memory history, so the same module works on the server.
- **`loadServerData(routes)`** is the router's `load` hook. After hydration it fetches page data on client navigation; on the server and before hydration it does nothing.
- **`defineServerApp`** describes the app for the CLI. It creates the server inside the app's own bundle, so the server and the components share one engine instance.

## Modes

| Mode | Rendered | Cached | Use for |
|---|---|---|---|
| `ssr` (default) | every request | never | content that depends on the request: cookies, the signed-in user, headers |
| `ssg` | once, at build (or first request) | forever | the same for everyone, rarely changes |
| `isr` | like `ssg`, refreshed in the background after `revalidate` s | until stale | the same for everyone, changes over time |
| client | not on the server | n/a | per visitor or per interaction: search results, carts, drafts |

Deciding:
- **Is the page the same for every visitor?** If not → `ssr`.
- **Does it change?** Never → `ssg`. Sometimes → `isr` with a `revalidate` matching how stale it may be.
- **Is a part of it per visitor** (cart badge, "hi, name")? Render it neutral on the server and fill it in on the client after hydration.

## Server routes

Server routes attach server-only behaviour to your route objects. They live in a module the client never imports.

```ts
import type { ServerRoute } from 'engine-ts/server';

export const serverRoutes: ServerRoute[] = [
  {
    route: HomeRoute,
    mode: 'ssg',
    paths: () => ['/'],
    load: async (_, set) => {
      set(FeaturedData, await featured());
    },
  },
  {
    route: ProductRoute,
    mode: 'isr',
    revalidate: 60,
    paths: async () => (await topProducts()).map((p) => `/products/${p.handle}`),
    load: async ({ params }, set) => {
      set(ProductData, await product(params?.groups?.handle ?? ''));
    },
    preload: ['src/pages/Product.ts'],
  },
  {
    route: AccountRoute,               // a layout: loads the user for every /account/* page
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(UserData, await userFromCookie(request));
    },
  },
  {
    route: OrdersRoute,                // its page: loads in parallel with the layout's loader
    mode: 'ssr',
    load: async ({ request }, set) => {
      set(OrdersData, await ordersFor(request));
    },
  },
  { route: NotFoundRoute, status: 404 },
];
```

| Field | Meaning |
|---|---|
| `route` | The route object (or the original of an alias) |
| `mode` | `'ssr'` (default), `'ssg'` or `'isr'` |
| `revalidate` | Seconds until an `isr` page is stale. Without it, `isr` behaves like `ssg` |
| `status` | HTTP status for the page, e.g. 404 |
| `paths()` | Paths to prerender in `build` (`ssg`/`isr`) |
| `load(context, set)` | Loads page data. `context` is `{ url, params, request? }` (no `request` during `build`) |
| `preload` | Vite manifest keys of the route's lazy modules, for `<link rel="modulepreload">` |

- **Which settings apply:** the deepest configured route in the matched chain decides `mode`, `revalidate` and `status`.
- **Loaders:** **all** loaders in the chain run, in parallel. A layout's loader and its page's loader cooperate.

## Server data

```ts
// data.ts (shared): one token per piece of page data
export const ProductData = serverToken<ProductDetail | null>('product');

// a page or component
const product = useServer(ProductData);
```

- A token has a unique key; that key is the property name in the serialized data.
- `set(token, value)` in a loader is type-checked against the token.
- Values must be JSON-serializable.

### `useServer` only during setup

`useServer` works synchronously in page factories, in components they create, and in route actions. After an `await`, in event handlers and in timers it throws:

```
useServer("product"): call it during setup … not after an await or in an event handler
```

Read it once and keep plain values:

```ts
export default function Product(parent: object) {
  let shown: ProductDetail | null = null;
  router.route(ProductRoute, () => {
    shown = useServer(ProductData);     // a route action: allowed
    title.textContent = shown?.title ?? 'Not found';
  });
  listen(addButton, 'click', () => {
    if (shown) {
      cart.add(shown);                  // a handler: uses the kept value
    }
  });
  …
}
```

### Data lifecycle

- **On the server:** set for one render, cleared after it.
- **On the client after hydration:** read from the page, available during hydration, released once hydration settles.
- **On client navigation:** fetched from `/path/__data.json` before route actions run, available during that navigation's setup, released once it settles.

Because it's released, page data doesn't pile up in memory; whatever you need later, keep it in your own variables.

### Ship lean data

Everything a loader `set`s is serialized into the page (and into `__data.json`). Map API responses to what the page shows:

```ts
function summary(product: ApiProduct): ProductSummary {
  return { handle: product.handle, title: product.title, image: product.image?.url ?? '', price: format(product.price) };
}
```

## Rendering, step by step

1. **Match** the URL with `router.match` (guards run). No match → `handle` returns `undefined`, so the request can fall through to static files.
2. **Load:** run the chain's loaders in parallel, outside the render lock.
3. **Render**, one render at a time, because renders share module state (the global `document`, the app's router):
   - parse the template (a fresh `linkedom` document),
   - navigate the app's router to the URL,
   - call `App(container)` in the root render scope,
   - wait until every outlet load has settled (lazy pages render too), bounded by `timeout`.
4. **Serialize:** normalize text nodes (see Hydration), record the `childNodes` path of every view created through `engine-ts/html`, and embed `<script id="__engine" type="application/json">` with the data and the paths (`<` escaped, so data can't close the script). Add `modulepreload` links for the route's `preload` modules. Output the document.
5. **Clean up:** destroy the app root (route listeners and subscriptions end), restore globals, release the lock.

Loaders run concurrently across requests; only the render itself is serialized. Lazy imports are warm after the first render, so the lock costs little.

## Hydration

```ts
await hydrate(container, App, router);
```

1. Read and remove the payload script.
2. Wait for the router's initial navigation.
3. **Resolve every recorded path to a node, up front**, before any app code runs, so app code moving nodes around can't shift positions.
4. Run `App(container)` in the root render scope. Each `html`/`mhtml`/`element`/`text` call returns the server's node for its position instead of creating one. Listeners and subscriptions attach to the existing DOM.
5. Lazy pages hydrate when their imports resolve. Each outlet has a stable scope key, so import order doesn't matter.
6. When all outlet loads have settled: release unclaimed nodes, stop checking for claims, release the page data. `hydrate` resolves here.

Without a payload (a client-only page), `hydrate` just mounts the app.

### How positions are recorded

- The server records each creation in each render scope by order: the n-th `html` call in scope `r.0`.
- On the client, the n-th call in the same scope claims it.
- Before serializing, the server inserts `<!---->` between adjacent text nodes (the HTML parser would merge them) and replaces empty text nodes with `<!---->` (the parser would drop them), so `childNodes` paths are identical after parsing. The client turns those placeholders back into text nodes.

### Rules for hydratable code

- **Build views synchronously** during setup, from `useServer` data and other synchronous inputs. Anything async (fetches, timers) runs on the client after hydration. Skip it on the server with `isServer`.
- **Same order on both sides.** Don't branch on `window`, `Date.now()`, `Math.random()`, `localStorage` or `isConnected` where views are created.
- **Client-only differences change text or attributes, not structure.** A cart badge renders `0` on both sides, then the browser sets the count.
- **Use `element()`/`text()`, not `document.createElement`,** for views that must hydrate.
- **Prefer composing in templates.** ``html`<div>${a}${b}</div>` `` is a no-op while hydrating. An imperative `parent.append(a)` into a parent that still holds unclaimed server nodes moves `a` to the end until the rest is claimed. That's harmless within one synchronous pass, but it can flash while a lazy page loads.
- **Valid HTML nesting.** The parser restructures invalid markup, which breaks the paths.

## Client navigation

After hydration, `loadServerData` (the router's `load` hook) runs before route actions:
- For routes with server data (any route in the chain with a `load`), it fetches `/path/__data.json`.
- For routes without, it sets empty data and makes no request.
- Latest wins: a slow response for an old navigation never overwrites newer data.

`__data.json` is answered by the server (SSR runs only the loaders, no render), or by the cache/static files for `ssg` and `isr` pages, so it always matches the HTML.

## Caching (SSG and ISR)

```ts
import { fsCache, memoryCache, type PageCache } from 'engine-ts/server';
```

| Cache | Behaviour |
|---|---|
| `memoryCache(maxEntries = 1000)` | LRU in memory, all operations O(1) |
| `fsCache(dir)` | `<dir>/<path>/index.html` + `<dir>/<path>/__data.json`: static-hosting layout, file time as the render time; refuses paths outside `dir` |
| custom | implement `{ get(path), set(path, entry), delete(path) }` (Redis, KV stores) |

Request handling for `ssg`/`isr`:
- **HIT:** cached and fresh → served.
- **STALE:** cached but older than `revalidate` → served, and a fresh render starts in the background.
- **MISS:** not cached → rendered now, stored, served.
- **Concurrent requests** for one path share a single render.
- **`server.revalidate(path)`** re-renders now, for on-demand ISR from a CMS webhook. The old page is served until the new one is ready.

Responses carry `x-engine-cache: HIT | STALE | MISS | BYPASS` (`BYPASS` = SSR).

## Preloading lazy pages

With `preload` on a server route and the Vite client manifest passed to the server, rendered pages get `<link rel="modulepreload">` for those modules and everything they import. The page chunk downloads in parallel with the entry, so hydration doesn't wait for it.

## The CLI

```sh
engine-ts dev     # Vite middleware + SSR from source; reloads the server entry on change
engine-ts build   # client bundle + manifest → dist/client; server bundle → dist/server; prerender
engine-ts start   # production server on dist/
```

- **`build`:**
  - Runs your Vite config twice: the client build with a manifest, and the SSR build of `src/entry-server.ts`.
  - Saves the original template as `dist/server/template.html`.
  - Prerenders every `paths()` of `ssg`/`isr` routes into `dist/client`. The root page replaces `index.html`, so the static output is deployable as is.
- **`start`:**
  - Serves `dist/client` files that have an extension (`/assets/*` cached forever).
  - Sends pages and `__data.json` to the engine with `fsCache('dist/client')`, so prerendered pages are ISR's starting point.
  - Uses the manifest for `preload`.
- **Environment:**
  - `PORT` (default 3000).
  - `REVALIDATE_SECRET` enables `POST /api/revalidate?path=/x&secret=…`.

## Custom hosting

The CLI is a thin layer over these:

```ts
import { createServer, fsCache, toNodeHandler } from 'engine-ts/server';

const server = createServer({ template, router, routes, serverRoutes, app: App, manifest, cache: fsCache('dist/client') });

await server.handle(request);           // standard Request → Response | undefined
await server.build({ outDir });         // prerender
await server.revalidate('/products/x');

http.createServer(toNodeHandler(server, { staticDir: 'dist/client', revalidateSecret }));
app.use(toNodeHandler(server));         // Express / Connect: unhandled requests go to next()
```

`handle` uses Web-standard `Request`/`Response`, so the server works on any runtime that has them and can run `linkedom`.

| `createServer` option | Default | Meaning |
|---|---|---|
| `template` | required | the built `index.html`, with the container element |
| `router`, `routes`, `app` | required | the app's router, route tree and root function |
| `serverRoutes` | `[]` | modes, loaders, paths, preloads |
| `containerId` | `'app'` | id of the container element |
| `cache` | `memoryCache()` | page cache for `ssg`/`isr` |
| `timeout` | `10000` | ms a render may take to settle |
| `manifest`, `base` | none, `'/'` | Vite manifest and asset base for `preload` |

## Errors and status codes

- **A loader or a render throws** → `handle` returns `500 Internal Server Error` and logs the error.
- **A render doesn't settle within `timeout`** → it fails, and the lock is released.
- **Unmatched paths** → `handle` returns `undefined`. The Node adapter answers 404, or passes to `next()`.
- **Statuses** come from the deepest configured route's `status` (`200` by default).
