# 1. Getting started

## Install

```sh
npm install engine-ts
```

Optional peer dependencies, only when you need them:
- `linkedom`: the DOM used for server rendering (`engine-ts/server`).
- `vite`: used by the `engine-ts` CLI (`dev`, `build`, `start`).

engine-ts ships ESM with type declarations. Any bundler that understands `package.json` `exports` works; the examples use Vite.

### TypeScript

Recommended compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true
  }
}
```

`DOM.Iterable` lets you `for..of` over `NodeList`s. With `"moduleResolution": "bundler"` (or `node16`/`nodenext`), subpath imports like `engine-ts/core` resolve to their types.

## A client-only app

Three steps: tell the engine how to place views, build a component, mount it.

```ts
// main.ts
import { attach, component, domRenderer, listen, setRenderer } from 'engine-ts/core';
import { html } from 'engine-ts/html';

// 1. Once, before anything is shown: views are DOM nodes.
setRenderer(domRenderer);

// 2. A component: builds its view, attaches it, wires behaviour.
const Counter = component((parent: object) => {
  const value = html`<output>0</output>`;
  const plus = html<HTMLButtonElement>`<button>+</button>`;
  const node = html`<div class="counter">${value}${plus}</div>`;
  attach(parent, node);

  let count = 0;
  listen(plus, 'click', () => {
    count++;
    value.textContent = String(count);
  });

  return node;
});

// 3. Mount: the container is the root of the logical tree.
const container = document.querySelector('#app')!;
container.append(Counter(container));
```

What happened:
- `setRenderer(domRenderer)` tells the engine to use DOM operations when it mounts and unmounts views (outlets, `destroy`).
- `component()` gives the function a **setup frame**. The first `attach(parent, node)` inside it makes `node` the owner of every owner-less call that follows. Here, `listen(plus, 'click', …)` is removed when `node` is destroyed.
- `html` builds DOM from a template. Strings become text, never markup. Nodes are inserted as they are.
- `count` is a plain variable: only this component reads it, so no state primitive is needed.

### Adding routes

```ts
import { createOutlet, setupRouter, type Route } from 'engine-ts/router';

export const HomeRoute: Route = { path: '/' };
export const ItemRoute: Route = { path: /\/items\/(?<id>\d+)/u };
export const router = setupRouter([HomeRoute, ItemRoute]);

const App = component((parent: object) => {
  const slot = html<Comment>`<!---->`;
  const node = html`<div><nav>…</nav><main>${slot}</main></div>`;
  attach(parent, node);

  const page = createOutlet(node, slot);
  router.route(HomeRoute, () => page.show(Home));
  router.route(ItemRoute, () => page.show(() => import('./pages/Item')));

  return node;
});
```

Pages loaded by an outlet are plain functions `(parent) => view`. The outlet gives them a setup frame, so they don't need `component()`. See [Routing](07-routing.md) and [Outlets and layouts](08-outlets-and-layouts.md).

## A server-rendered app

The same components render on the server and hydrate in the browser. You need two entry files and no server code:

```ts
// src/app.ts (shared)
import { domRenderer, setRenderer } from 'engine-ts/core';
import { setupRouter } from 'engine-ts/router';
import { loadServerData } from 'engine-ts/ssr';

setRenderer(domRenderer);
export const routes = [HomeRoute, ProductRoute];
export const router = setupRouter(routes, { load: loadServerData(routes) });
export const App = component((container: Element) => { … });

// src/entry-client.ts
import { hydrate } from 'engine-ts/ssr';
await hydrate(document.querySelector('#app')!, App, router);

// src/entry-server.ts (Node only)
import { defineServerApp } from 'engine-ts/server';
export default defineServerApp({ router, routes, serverRoutes, app: App });
```

```json
{
  "scripts": {
    "dev": "engine-ts dev",
    "build": "tsc && engine-ts build",
    "start": "engine-ts start"
  }
}
```

`index.html` needs a container (`<div id="app"></div>`) and the client entry script. See [Server rendering](11-server-rendering.md) for server routes, data loading and modes.

## Suggested project layout

The engine doesn't impose one. This layout keeps responsibilities clear:

```
src/
  main.ts | entry-client.ts | entry-server.ts
  app.ts                  root component: providers, outlet, top-level routes
  routes.ts               route objects and the router
  stores/                 createStore definitions: data + actions
  services/               network, storage, anything non-visual
  components/             reusable components
  pages/                  route targets, lazy-loaded
  layouts/                pages that own an outlet for their children
```

- Keep route objects in one module: components import them to listen, the router imports them to match.
- Keep server-only code (loaders, server routes) in files the client never imports.

## Next

Read [The logical tree](02-logical-tree.md) and [Components](03-components.md). Together they cover nearly everything you write day to day.
