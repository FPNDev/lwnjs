# ssr-app: a mock shop with SSG, ISR and SSR

A small shop on [mock.shop](https://mock.shop) (Shopify's demo store API) and [dummyjson](https://dummyjson.com) (users, orders). Every page is server-rendered and hydrated, and each one uses the mode that fits its data.

```sh
npm install
npm run dev      # engine-ts dev: Vite + SSR, http://localhost:3000
npm run build    # tsc && engine-ts build: client, server, prerender
npm start        # engine-ts start: production server on dist/
```

There is no server code in the app: the `engine-ts` CLI runs Vite in dev, builds both bundles, prerenders, and serves the result. `src/entry-server.ts` only describes the app with `defineServerApp(...)`.

## Which page uses what, and why

| Page | Mode | Why |
|---|---|---|
| `/` featured collections | **SSG** | Same for everyone, rarely changes. Built once at build time. |
| `/collections/:handle` | **ISR**, 300 s | Same for everyone, changes now and then. Prerendered, served from cache, refreshed in the background. |
| `/products/:handle` | **ISR**, 60 s | Prices change. Featured products are prerendered; any other product renders on its first request and is cached after (`MISS`, then `HIT`). |
| `/search` | **SSG shell + client data** | Results are per visitor and per keystroke: the page is static, and the browser calls the API itself. |
| `/account`, `/account/orders` | **SSR** | Depends on the signed-in user (a cookie). Rendered on every request, never cached. "Switch user" changes the cookie. |
| cart | **client only** | Per visitor, lives in localStorage. The server renders it empty; the browser fills it in after hydration. |
| unknown paths | SSR, status 404 | |

Rules of thumb:
- **The same for everyone?** Cache it: SSG if it never changes, ISR if it does.
- **Depends on the request?** SSR.
- **Depends on the visitor's interaction?** Keep it on the client.

The response header `x-engine-cache` shows what happened: `HIT`, `STALE` (served old, refreshing), `MISS` or `BYPASS` (SSR).

**On-demand revalidation** (e.g. from a CMS webhook):

```sh
REVALIDATE_SECRET=dev npm start
curl -X POST "http://localhost:3000/api/revalidate?path=/products/slides&secret=dev"
```

## Structure

```
src/
  entry-client.ts        hydrate(container, App, router)
  entry-server.ts        defineServerApp({ router, routes, serverRoutes, app }) (Node only)
  server-routes.ts       modes, revalidate, paths, loaders, preloads (Node only)
  app.ts                 App: frame, header, page outlet, routes
  routes.ts              routes + router (same on both sides)
  data.ts                server data tokens
  api.ts                 API calls, mapped to small page-shaped objects
  cart.ts                client-only cart store
  pages/                 Home (eager), Collection, Product, Search (lazy), NotFound
  account/               AccountLayout (lazy, own outlet), Overview (index route), Orders (lazy)
  components/            Header, ProductCard, CartDrawer (portal)
```

## What to look at

- **Layouts with their own outlet.** App shows `AccountLayout` for the whole `/account/*` subtree with one route action. The layout has its own `createOutlet` and routes: `OverviewRoute` (an index route, `path: ''`) and `OrdersRoute`. Going from overview to orders keeps the layout and swaps only the inner page. Both levels load their data in parallel: the layout's loader (user) and the page's (orders).
- **Params change, page stays.** Going from one product to another, App's outlet sees the same lazy factory and keeps the page. `Product` follows `ProductRoute` itself and updates its nodes in place from the new page data. `Collection` does the same.
- **`useServer` during setup only.** Pages read their data in the factory or in route actions (both run synchronously after the data loaded) and keep plain values for later. Event handlers use those values, never `useServer`.
- **Lean data.** `api.ts` maps every response to what the page shows. Everything a loader sets is serialized into the page.
- **Preloading.** Server routes list their lazy page modules (`preload`). With Vite's manifest the server emits `<link rel="modulepreload">`, so the page chunk is ready by the time hydration needs it.
- **Styles in the entry CSS.** The pages share `ui.module.scss` with the eager shell, so their styles are in the first CSS file. Server-rendered markup never shows unstyled while a lazy chunk loads.
- **Hydration-safe client state.** The header renders the cart count as `0` on both sides, then the browser sets the real number: only text changes, so the node structure matches.
