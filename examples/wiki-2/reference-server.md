# Server reference

Server APIs run in Node. Import them from `lwnjs/server`. The client side of hydration and page-data access comes from `lwnjs/ssr`.

~~~ts
import { defineServerApp } from 'lwnjs/server';
import { hydrate, loadServerData, serverToken, useServer } from 'lwnjs/ssr';
~~~

## One app shared by server and browser

Keep the shared app setup and route definitions in modules that both entry points can import. Put request handling and server-only loaders in modules that only the server entry imports.

~~~ts
// app.ts
export const routes = [HomeRoute, ProductRoute];
export const router = setupRouter(routes, {
  load: loadServerData(routes),
});
export const App = component((container: Element) => {
  // Build the same views on server and client.
});

// entry-server.ts
export default defineServerApp({
  router,
  routes,
  serverRoutes,
  app: App,
});

// entry-client.ts
await hydrate(document.querySelector('#app')!, App, router);
~~~

The app function builds views synchronously. Lazy page factories can load through outlets. The server entry returns a description of the app, not a separately constructed server. The CLI creates the server from that description in the server bundle, so the router and components share one engine instance.

## Page data

A server token names one serialized value. Declare it in a module shared by loaders and components.

~~~ts
// data.ts
export const ProductData = serverToken<Product>('product');

// server-routes.ts
{
  route: ProductRoute,
  load: async ({ params }, set) => {
    const handle = params?.groups?.handle ?? '';
    set(ProductData, await getProduct(handle));
  },
}

// Product.ts
const product = useServer(ProductData);
~~~

The loader's `set(token, value)` stores the value in page data. Values must be JSON serializable. Use unique token keys because the key is the property name in the serialized payload.

Loaders for every route in the matched chain run in parallel. For example, an account layout and its orders page can each load their own data at the same time.

`useServer(token)` is synchronous setup-time access. Call it in a page factory, a component created by that factory, or a route action. Do not call it after an `await` or from an event handler. Read the value once during setup and pass it to work that happens later. A missing key throws an error that names the token.

On the first browser visit, hydration reads the embedded server payload. On later client navigation, the router load hook fetches `/path/__data.json` before route actions run. Page data is released after the route and its outlets settle.

## Server routes

A server route associates server-only behavior with a route object.

~~~ts
import type { ServerRoute } from 'lwnjs/server';

const serverRoutes: ServerRoute[] = [
  {
    route: ProductRoute,
    mode: 'isr',
    revalidate: 60,
    paths: () => ['/products/tea'],
    load: async ({ params }, set) => {
      set(ProductData, await getProduct(params?.groups?.handle ?? ''));
    },
    preload: ['src/pages/Product.ts'],
  },
];
~~~

| Field | Meaning |
|---|---|
| `route` | A route object from the shared route definitions. For aliases, use the original route or alias. |
| `mode` | `ssr`, `ssg`, or `isr`. Default is `ssr`. |
| `revalidate` | Seconds before an `isr` entry becomes stale. With no value, `isr` behaves like `ssg`. |
| `status` | HTTP response status for this route, such as `404`. |
| `paths` | Paths to prerender during `server.build()`. Used by `ssg` and `isr`. |
| `load` | Async or sync loader that calls `set` with page data. |
| `preload` | Vite manifest keys for lazy client modules to preload with the page. |

A route loader receives `{ url, params, request }`. `request` is available for per-request SSR loads. It is absent when building static output and when generating or refreshing cacheable SSG and ISR pages. For personalized data such as a signed-in user, use `ssr` and inspect the request. Never put user-specific output in an `ssg` or `isr` route, because those modes reuse cached pages.

The matched chain's most-specific server route determines the page mode and status. Loaders from every configured route in the chain still run. This lets a layout and its child page contribute data independently.

## Choose a rendering mode

| Mode | First render | Cache behavior | Good fit |
|---|---|---|---|
| `ssr` | Each request | Not cached | Cookies, request headers, user-specific pages |
| `ssg` | During build when listed, or on first request | Kept indefinitely | Stable pages shared by everyone |
| `isr` | During build when listed, or on first request | Served until stale, then refreshed in background | Shared pages that change periodically |

In `isr`, a stale response is returned immediately while a refresh runs. If no entry exists yet, the request waits for the first render. Concurrent renders of the same path share one generation.

`server.build({ outDir })` renders each path returned by an `ssg` or `isr` route's `paths()` function. It writes the static-hosting layout with `index.html` and `__data.json`. Read the input HTML template before writing build output to the same directory, because prerendering `/` writes that directory's `index.html`.

## Configure the server

`createServer(options)` accepts these fields:

| Option | Meaning |
|---|---|
| `template` | Built `index.html`, including the app container |
| `router` | The shared router. The server navigates it with memory history. |
| `routes` | The same route list given to the router |
| `serverRoutes` | Server-only route configuration |
| `app` | Synchronous function that builds the app into the container |
| `containerId` | Container element ID. Default is `app`. |
| `cache` | Cache for `ssg` and `isr`; default is `memoryCache()`. |
| `timeout` | Maximum render settle time in milliseconds. Default is 10,000. |
| `manifest` | Vite client manifest for module preloads |
| `base` | Public base path for preloaded assets. Default is `/`. |

Methods returned by `createServer`:

- `handle(request)` handles `GET` and `HEAD` page requests and `GET` or `HEAD` requests ending in `/__data.json`. It returns `undefined` for an unmatched route or an unsupported method.
- `build({ outDir })` prerenders configured static paths and returns their path list.
- `revalidate(path)` immediately refreshes a cached path. The old entry remains available until the replacement is ready.

A render uses the configured container inside the HTML template. If that element is missing, rendering throws an error naming its expected ID. Outlet work and lazy imports are awaited. The render fails if it does not settle before the timeout.

## Caches

A page cache implements three asynchronous methods:

~~~ts
type CacheEntry = {
  html: string;
  data: string;
  status: number;
  createdAt: number;
};

type PageCache = {
  get(path: string): Promise<CacheEntry | undefined>;
  set(path: string, entry: CacheEntry): Promise<void>;
  delete(path: string): Promise<void>;
};
~~~

- `memoryCache(maxEntries?)` uses an in-memory least-recently-used cache. Its default capacity is 1,000 entries.
- `fsCache(directory)` stores each path as `index.html` and `__data.json` under that directory. It guards against paths that escape the cache directory.

The same cache interface can be supplied to `createServer`. The file cache is also the static output format used by `server.build()`.

## Hydration helpers

Import client-safe helpers from `lwnjs/ssr`:

- `serverToken<T>(key)` creates a typed key for server data.
- `useServer(token)` reads the current page's data during setup.
- `hydrate(container, app, router)` adopts server-created nodes and resolves when lazy pages have hydrated.
- `loadServerData(routes)` creates the router load hook for client navigations after hydration.
- `isServer` reports whether `window` is absent.

The router hook remains inactive in client-only apps and before hydration. During an SSR render, the server pauses it because loaders already ran on the server.

## Hosting adapters

`defineServerApp(config)` packages the app configuration for the CLI. For custom hosting, call `createServer(config)` yourself.

`toNodeHandler(server, options?)` adapts a server to Node HTTP or Connect-style middleware. Options can serve static files from `staticDir` and enable an on-demand ISR endpoint with `revalidateSecret`. When that secret is configured, a matching request to `POST /api/revalidate?path=/page&secret=...` refreshes the given path.

The Vite-based CLI provides `dev`, `build`, and `start`. See [CLI reference](reference-cli.md) for commands and build output.

