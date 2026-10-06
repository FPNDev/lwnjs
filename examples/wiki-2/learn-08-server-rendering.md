# 08. Server rendering

LWN can render the same app to HTML on the server, then let the browser attach listeners and continue from those nodes. The server can render every request, render known paths during a build, or cache and refresh pages over time.

## Choose a rendering mode

| Mode        | When it renders                                      | Useful for                                                |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------- |
| SSR         | Every request                                        | Content that depends on a cookie, request header, or user |
| SSG         | At build time or on first request, then stays cached | Shared content that rarely changes                        |
| ISR         | Like SSG, then regenerates after a freshness window  | Shared content that changes periodically                  |
| Client-only | In the browser                                       | Per-visitor data or highly interactive content            |

A page can have shared server-rendered content and client-only state. For example, the shop example renders the cart count as zero on both server and client, then reads the visitor's cart from localStorage in the browser.

## Separate client-safe and server-only code

The app, routes, data tokens, and page components can be shared by server and browser. Put database access, secrets, and server route loaders in a module that only the server entry imports.

The client-safe helpers are in lwn-js/ssr. Node rendering and caches are in lwn-js/server.

## Describe page data

Create a token that identifies one typed piece of page data:

```ts
import { serverToken } from 'lwn-js/ssr';

export const ProductData = serverToken<Product | null>('product');
```

A server route loads data before rendering. The page reads it during synchronous setup:

```ts
import { attach } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { ProductData } from '../data';

export default function Product(parent: object) {
  const product = useServer(ProductData);
  const node = html`<article>
    <h1>${product?.title ?? 'Not found'}</h1>
  </article>`;
  attach(parent, node);
  return node;
}
```

Read server data only during setup, such as in a page factory or a route action. Keep the value in a local variable for event handlers. Data is serialized, so pass only the fields the page needs and ensure values are JSON-serializable.

## Connect the app on both sides

The shared app creates the router and uses loadServerData as its load hook. The client entry calls hydrate. The Node entry exports a server app description:

```ts
// Shared app
export const router = setupRouter(routes, { load: loadServerData(routes) });

// Browser entry
await hydrate(container, App, router);

// Node entry
export default defineServerApp({
  router,
  routes,
  serverRoutes,
  app: App,
});
```

A server route associates a route object with a mode, loader, optional prerendered paths, and optional lazy module preloads. Loaders for the matched route chain run in parallel, so a layout and its page can load independent data together.

## What hydration requires

Hydration adopts existing nodes when app code creates views in the same order as the server render. The engine records creation paths for views created through lwn-js/html. It resolves those paths before running client app code so DOM moves during setup do not shift later lookups.

Keep view creation synchronous and structurally consistent between server and browser:

- Do not branch the view structure on localStorage, current time, randomness, or browser-only values.
- Use html, mhtml, element, and text for nodes that should be adopted.
- Keep markup valid. Browser parsers may repair invalid nesting.
- Render a neutral initial value on both sides, then update visitor-specific text or attributes after hydration.

Lazy pages render on the server when an outlet shows them. The server waits for outlet work to settle, subject to its timeout.

Continue with [Explore the example apps](learn-09-example-apps.md), then use the [Server reference](reference-server.md) for options and lifecycle details.
